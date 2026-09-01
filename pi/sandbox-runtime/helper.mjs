#!/usr/bin/env node
import { constants } from "node:fs";
import { access, mkdir, open, opendir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHelperProtocol } from "./src/helper-protocol.mjs";
import { selectLsEntries } from "./src/ls-selection.mjs";
import { escapePathForDisplay } from "./src/path-display.mjs";
import {
  BoundedNewlineDecoder,
  FILE_TOO_LARGE,
  RPC_BINARY_CHUNK_SIZE,
  RPC_FRAME_PAYLOAD_LIMIT,
  RPC_READ_CONCURRENCY_LIMIT,
  RPC_STREAM_PAYLOAD_LIMIT,
  RPC_STREAM_TOO_LARGE,
  RpcFrameWriter,
  TEXT_READ_MAX_BYTES,
  TEXT_READ_MAX_LINES,
} from "./src/rpc-framing.mjs";
import {
  COMMAND_OUTPUT_MAX_BYTES,
  FIND_DEFAULT_LIMIT,
  FIND_MAX_LIMIT,
  GREP_DEFAULT_CONTEXT,
  GREP_DEFAULT_LIMIT,
  GREP_MAX_CONTEXT,
  GREP_MAX_LIMIT,
  GREP_MAX_LINE_LENGTH,
  LS_DEFAULT_LIMIT,
  LS_MAX_LIMIT,
  validateIntegerParameter,
} from "./src/search-limits.mjs";

const activeChildren = new Set();
const outputWriter = new RpcFrameWriter(process.stdout);

async function respond(message) {
  await outputWriter.write(message);
}

function requireAbsolute(value, label = "path") {
  if (typeof value !== "string" || !path.isAbsolute(value) || value.includes("\0")) {
    throw new Error(`${label} must be an absolute path`);
  }
  return value;
}

function killGroup(child, signal = "SIGKILL") {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    try { child.kill(signal); } catch {}
  }
}

function detectImageMime(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) return "image/gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buffer.length >= 2 && buffer.subarray(0, 2).toString("ascii") === "BM") return "image/bmp";
  return null;
}

function appendBounded(parts, length, chunk, maxBytes) {
  const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  const available = Math.max(0, maxBytes - length);
  const retained = Math.min(available, bytes.length);
  if (retained > 0) parts.push(bytes.subarray(0, retained));
  return { length: length + retained, truncated: retained < bytes.length };
}

function captureFailureMessage(command, code, stderr, stderrTruncated, maxBytes) {
  let message = stderr.toString("utf8").trim() || `${command} exited with code ${code}`;
  if (stderrTruncated) message += `\n[stderr truncated at ${maxBytes} bytes]`;
  return message;
}

function runCapture(command, args, options = {}) {
  const { signal, maxBytes = COMMAND_OUTPUT_MAX_BYTES } = options;
  if (signal?.aborted) return Promise.reject(new Error("Operation aborted"));
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeChildren.add(child);
    const stdoutParts = [];
    const stderrParts = [];
    let stdoutLength = 0;
    let stderrLength = 0;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let killedForStdoutLimit = false;
    let settled = false;
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      activeChildren.delete(child);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => killGroup(child);
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk) => {
      if (stdoutTruncated) return;
      const appended = appendBounded(stdoutParts, stdoutLength, chunk, maxBytes);
      stdoutLength = appended.length;
      if (appended.truncated) {
        stdoutTruncated = true;
        killedForStdoutLimit = true;
        killGroup(child);
      }
    });
    child.stderr.on("data", (chunk) => {
      if (stderrTruncated) return;
      const appended = appendBounded(stderrParts, stderrLength, chunk, maxBytes);
      stderrLength = appended.length;
      stderrTruncated = appended.truncated;
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => finish(() => {
      const stdout = Buffer.concat(stdoutParts, stdoutLength);
      const stderr = Buffer.concat(stderrParts, stderrLength);
      if (signal?.aborted) reject(new Error("Operation aborted"));
      else if (!killedForStdoutLimit && code !== 0) {
        reject(new Error(captureFailureMessage(command, code, stderr, stderrTruncated, maxBytes)));
      } else {
        resolve({ stdout, stderr, stdoutTruncated, stderrTruncated });
      }
    }));
  });
}

async function probe() {
  return { node: process.version };
}

function operationDependencyError(error, operation, executable) {
  if (!error || typeof error !== "object" || error.code !== "ENOENT") return error;
  return Object.assign(
    new Error(`${operation} requires ${executable}: executable not found`),
    { code: "ENOENT" },
  );
}

function limitError(message, code) {
  return Object.assign(new Error(message), { code });
}

function positiveInteger(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

class AbortableLimiter {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
    this.waiters = [];
  }

  async run(signal, operation) {
    await this.acquire(signal);
    try {
      return await operation();
    } finally {
      this.active--;
      this.releaseNext();
    }
  }

  acquire(signal) {
    if (signal?.aborted) return Promise.reject(new Error("Operation aborted"));
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, signal, onAbort: undefined };
      waiter.onAbort = () => {
        const index = this.waiters.indexOf(waiter);
        if (index === -1) return;
        this.waiters.splice(index, 1);
        reject(new Error("Operation aborted"));
      };
      signal?.addEventListener("abort", waiter.onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  releaseNext() {
    const waiter = this.waiters.shift();
    if (!waiter) return;
    waiter.signal?.removeEventListener("abort", waiter.onAbort);
    this.active++;
    waiter.resolve();
  }
}

const readLimiter = new AbortableLimiter(RPC_READ_CONCURRENCY_LIMIT);

async function streamSnapshot(handle, snapshot, metadata, signal, stream) {
  if (snapshot.size > RPC_STREAM_PAYLOAD_LIMIT) {
    throw limitError(
      `File is ${snapshot.size} bytes; maximum full-file payload is ${RPC_STREAM_PAYLOAD_LIMIT} bytes`,
      FILE_TOO_LARGE,
    );
  }
  await stream.start(snapshot.size, metadata);
  let position = 0;
  while (position < snapshot.size) {
    signal.throwIfAborted();
    const length = Math.min(RPC_BINARY_CHUNK_SIZE, snapshot.size - position);
    const chunk = Buffer.allocUnsafe(length);
    const { bytesRead } = await handle.read(chunk, 0, length, position);
    if (bytesRead !== length) throw new Error("File changed or ended while it was being streamed");
    position += bytesRead;
    await stream.chunk(chunk);
  }
  const finalStat = await handle.stat();
  if (finalStat.size !== snapshot.size) throw new Error("File size changed while it was being streamed");
}

async function scanTextWindow(handle, snapshot, params, signal) {
  const startLine = positiveInteger(params?.offset, 1);
  const userLimit = params?.limit === undefined ? undefined : positiveInteger(params.limit, 1);
  const output = Buffer.allocUnsafe(TEXT_READ_MAX_BYTES);
  let outputLength = 0;
  let outputLines = 0;
  let selectedAllLines = 0;
  let selectedCountingLines = 0;
  let selectedTotalBytes = 0;
  let lineNumber = 1;
  let firstLineBytes;
  let firstLineKnown = false;
  let firstLineExceedsLimit = false;
  let truncated = false;
  let truncatedBy = null;
  let selectionComplete = false;
  let selectionHasNext = false;
  let reachedEof = false;
  let stopEarly = false;

  const isSelectedLine = (number) => number >= startLine
    && (userLimit === undefined || number < startLine + userLimit);

  let current;
  const beginLine = () => {
    const selected = isSelectedLine(lineNumber);
    current = {
      selected,
      length: 0,
      nonempty: false,
      outputStart: outputLength,
      retained: selected && !truncated,
      selectedIndex: 0,
    };
    if (!selected) return;
    selectedAllLines++;
    current.selectedIndex = selectedAllLines;
    if (selectedAllLines > 1) {
      selectedTotalBytes++;
      if (current.retained) {
        if (outputLength + 1 <= TEXT_READ_MAX_BYTES) output[outputLength++] = 0x0a;
        else {
          truncated = true;
          truncatedBy = "bytes";
          current.retained = false;
          outputLength = current.outputStart;
        }
      }
    }
  };

  const truncateCurrent = (reason) => {
    if (!truncated) {
      truncated = true;
      truncatedBy = reason;
    }
    if (current?.retained) outputLength = current.outputStart;
    if (current) current.retained = false;
  };

  const addPiece = (piece) => {
    if (!current.selected || piece.length === 0) return;
    current.length += piece.length;
    current.nonempty = true;
    selectedTotalBytes += piece.length;
    if (current.selectedIndex === 1 && current.length > TEXT_READ_MAX_BYTES) firstLineExceedsLimit = true;
    if (!current.retained) return;
    if (selectedCountingLines >= TEXT_READ_MAX_LINES) {
      truncateCurrent("lines");
      return;
    }
    if (outputLength + piece.length > TEXT_READ_MAX_BYTES) {
      truncateCurrent("bytes");
      return;
    }
    piece.copy(output, outputLength);
    outputLength += piece.length;
  };

  const finishLine = (endedByLf) => {
    if (!current.selected) return;
    const nextSelected = endedByLf && isSelectedLine(lineNumber + 1);
    const countable = current.nonempty || nextSelected;
    if (countable) {
      selectedCountingLines++;
      if (current.retained && selectedCountingLines > TEXT_READ_MAX_LINES) truncateCurrent("lines");
      if (current.retained) outputLines++;
    }
    if (current.selectedIndex === 1) {
      firstLineKnown = true;
      firstLineBytes = current.length;
      if (current.length > TEXT_READ_MAX_BYTES) firstLineExceedsLimit = true;
    }
    if (userLimit !== undefined && current.selectedIndex === userLimit) {
      selectionComplete = true;
      selectionHasNext = endedByLf;
    }
  };

  beginLine();
  let position = 0;
  while (position < snapshot.size && !stopEarly) {
    signal.throwIfAborted();
    const length = Math.min(RPC_BINARY_CHUNK_SIZE, snapshot.size - position);
    const chunk = Buffer.allocUnsafe(length);
    const { bytesRead } = await handle.read(chunk, 0, length, position);
    if (bytesRead === 0) throw new Error("File ended while text was being scanned");
    position += bytesRead;
    let offset = 0;
    while (offset < bytesRead) {
      const newline = chunk.indexOf(0x0a, offset);
      if (newline === -1 || newline >= bytesRead) {
        addPiece(chunk.subarray(offset, bytesRead));
        break;
      }
      addPiece(chunk.subarray(offset, newline));
      finishLine(true);
      lineNumber++;
      beginLine();
      offset = newline + 1;

      if (snapshot.size > RPC_STREAM_PAYLOAD_LIMIT && position < snapshot.size && (truncated || selectionComplete)) {
        stopEarly = true;
        break;
      }
    }
    if (snapshot.size > RPC_STREAM_PAYLOAD_LIMIT && position < snapshot.size && truncated) stopEarly = true;
  }

  if (!stopEarly) {
    finishLine(false);
    reachedEof = true;
  }

  if (selectedAllLines === 0) {
    // Offset validity must be exact. A large file is scanned through EOF when
    // the requested line has not yet been found.
    throw new Error(`Offset ${params?.offset} is beyond end of file (${lineNumber} lines total)`);
  }

  const selectionExact = reachedEof || selectionComplete;
  const totalFileLines = reachedEof ? lineNumber : undefined;
  const hasMore = truncated || (userLimit !== undefined && selectionComplete && selectionHasNext);
  const nextOffset = truncated
    ? startLine + outputLines
    : hasMore
      ? startLine + selectedAllLines
      : undefined;
  const truncation = truncated && selectionExact
    ? {
        truncated: true,
        truncatedBy,
        totalLines: selectedCountingLines,
        totalBytes: selectedTotalBytes,
        outputLines,
        outputBytes: outputLength,
        lastLinePartial: false,
        firstLineExceedsLimit,
        maxLines: TEXT_READ_MAX_LINES,
        maxBytes: TEXT_READ_MAX_BYTES,
      }
    : undefined;

  return {
    data: output.subarray(0, outputLength),
    metadata: {
      kind: "text",
      startLine,
      totalFileLines,
      exactTotal: reachedEof,
      hasMore,
      nextOffset,
      userLimitedLines: userLimit === undefined ? undefined : selectedAllLines,
      outputLines,
      truncated,
      truncatedBy,
      truncation,
      firstLineExceedsLimit,
      firstLineBytes: firstLineKnown ? firstLineBytes : undefined,
    },
  };
}

async function readOperationUnrestricted(params, signal, stream) {
  if (!Array.isArray(params?.paths) || params.paths.length === 0) throw new Error("read paths must be a non-empty array");
  let handle;
  let selectedPath;
  let snapshot;
  let header;
  let lastError;
  for (const candidateValue of params.paths) {
    const candidate = requireAbsolute(candidateValue);
    try {
      signal.throwIfAborted();
      handle = await open(candidate, "r");
      selectedPath = candidate;
      snapshot = await handle.stat();
      header = Buffer.alloc(Math.min(16, snapshot.size));
      if (header.length > 0) {
        const { bytesRead } = await handle.read(header, 0, header.length, 0);
        header = header.subarray(0, bytesRead);
      }
      break;
    } catch (error) {
      lastError = error;
      try { await handle?.close(); } catch {}
      handle = undefined;
      if (signal.aborted) throw new Error("Operation aborted");
    }
  }
  if (!handle || !selectedPath || !snapshot || !header) throw lastError ?? new Error("File is not readable");

  try {
    const mimeType = detectImageMime(header);
    if (params?.mode === "full") {
      await streamSnapshot(handle, snapshot, { kind: "full", path: selectedPath, mimeType }, signal, stream);
      return {};
    }
    if (mimeType) {
      await streamSnapshot(handle, snapshot, { kind: "image", path: selectedPath, mimeType }, signal, stream);
      return {};
    }

    const text = await scanTextWindow(handle, snapshot, params, signal);
    await stream.start(text.data.length, { ...text.metadata, path: selectedPath, mimeType: null });
    for (let offset = 0; offset < text.data.length; offset += RPC_BINARY_CHUNK_SIZE) {
      signal.throwIfAborted();
      await stream.chunk(text.data.subarray(offset, Math.min(text.data.length, offset + RPC_BINARY_CHUNK_SIZE)));
    }
    return {};
  } finally {
    await handle.close();
  }
}

async function readOperation(params, signal, stream) {
  return readLimiter.run(signal, () => readOperationUnrestricted(params, signal, stream));
}

function isMissingPathError(error) {
  return error
    && typeof error === "object"
    && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

async function mutationKeyOperation(params, signal) {
  const target = path.resolve(requireAbsolute(params?.path, "mutation path"));
  signal.throwIfAborted();
  try {
    const key = await realpath(target);
    signal.throwIfAborted();
    return { available: true, key };
  } catch (error) {
    signal.throwIfAborted();
    if (isMissingPathError(error)) return { available: true, key: target };
    return { available: false };
  }
}

async function writeOperation(params, signal, _stream, body) {
  const target = requireAbsolute(params?.path);
  let data;
  if (Buffer.isBuffer(body)) data = body;
  else if (typeof params?.content === "string") data = Buffer.from(params.content, "utf8");
  else throw new Error("write requires a streamed request body");
  if (data.length > RPC_STREAM_PAYLOAD_LIMIT) {
    throw limitError(
      `Write body is ${data.length} bytes; maximum is ${RPC_STREAM_PAYLOAD_LIMIT} bytes`,
      RPC_STREAM_TOO_LARGE,
    );
  }
  signal.throwIfAborted();
  await mkdir(path.dirname(target), { recursive: true });
  signal.throwIfAborted();
  await writeFile(target, data);
  signal.throwIfAborted();
  return { bytes: data.length };
}

async function listOperation(params, signal) {
  const limit = validateIntegerParameter(params?.limit, {
    name: "ls limit",
    defaultValue: LS_DEFAULT_LIMIT,
    minimum: 1,
    maximum: LS_MAX_LIMIT,
  });
  const target = requireAbsolute(params?.path);
  signal.throwIfAborted();
  const rootStat = await stat(target);
  signal.throwIfAborted();
  if (!rootStat.isDirectory()) throw new Error(`Not a directory: ${target}`);

  const directory = await opendir(target);
  try {
    const selection = await selectLsEntries({
      iterator: directory[Symbol.asyncIterator](),
      limit,
      signal,
      async classify(dirent) {
        try {
          const entryStat = await stat(path.join(target, dirent.name));
          return entryStat.isDirectory();
        } catch {
          // Match Pi's built-in ls behavior: skip entries that cannot be statted.
          return undefined;
        }
      },
    });
    return { ...selection, limit };
  } finally {
    // The selector returns its iterator, and this remains a second cleanup
    // attempt for implementations that do not close from iterator.return().
    try { await directory.close(); } catch {}
  }
}

async function isInsideGitRepository(searchPath) {
  for (let current = searchPath; ; current = path.dirname(current)) {
    try {
      await stat(path.join(current, ".git"));
      return true;
    } catch {}
    const parent = path.dirname(current);
    if (parent === current) return false;
  }
}

async function findOperation(params, signal) {
  const limit = validateIntegerParameter(params?.limit, {
    name: "find limit",
    defaultValue: FIND_DEFAULT_LIMIT,
    minimum: 1,
    maximum: FIND_MAX_LIMIT,
  });
  const searchPath = requireAbsolute(params?.path);
  if (typeof params?.pattern !== "string") throw new Error("find pattern must be a string");
  await access(searchPath, constants.F_OK);
  const args = ["--glob", "--color=never", "--print0", "--hidden", "--exclude", "node_modules", "--exclude", ".git"];
  if (!(await isInsideGitRepository(searchPath))) args.push("--no-require-git");
  args.push("--max-results", String(limit));
  let pattern = params.pattern;
  if (pattern.includes("/")) {
    args.push("--full-path");
    if (!pattern.startsWith("/") && !pattern.startsWith("**/") && pattern !== "**") pattern = `**/${pattern}`;
  }
  args.push("--", pattern, searchPath);
  let result;
  try {
    result = await runCapture("fd", args, { signal, maxBytes: COMMAND_OUTPUT_MAX_BYTES });
  } catch (error) {
    throw operationDependencyError(error, "find", "fd");
  }

  const paths = [];
  let recordStart = 0;
  while (paths.length < limit) {
    const recordEnd = result.stdout.indexOf(0x00, recordStart);
    if (recordEnd === -1) break;
    if (recordEnd > recordStart) {
      paths.push(result.stdout.subarray(recordStart, recordEnd).toString("utf8"));
    }
    recordStart = recordEnd + 1;
  }
  return {
    paths,
    limit,
    limitReached: paths.length >= limit,
    stdoutTruncated: result.stdoutTruncated,
    stderrTruncated: result.stderrTruncated,
  };
}

function displayGrepPath(filePath, searchPath, directory) {
  if (directory) {
    const relative = path.relative(searchPath, filePath);
    if (relative && !relative.startsWith("..")) return relative;
  }
  return path.basename(filePath);
}

function truncateGrepLine(value) {
  const sanitized = value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "")
    .replace(/\n+$/, "");
  if (sanitized.length <= GREP_MAX_LINE_LENGTH) return { text: sanitized, truncated: false };
  return {
    text: `${sanitized.slice(0, GREP_MAX_LINE_LENGTH)}... [truncated]`,
    truncated: true,
  };
}

async function grepOperation(params, signal) {
  const limit = validateIntegerParameter(params?.limit, {
    name: "grep limit",
    defaultValue: GREP_DEFAULT_LIMIT,
    minimum: 1,
    maximum: GREP_MAX_LIMIT,
  });
  const context = validateIntegerParameter(params?.context, {
    name: "grep context",
    defaultValue: GREP_DEFAULT_CONTEXT,
    minimum: 0,
    maximum: GREP_MAX_CONTEXT,
  });
  const searchPath = requireAbsolute(params?.path);
  if (typeof params?.pattern !== "string") throw new Error("grep pattern must be a string");
  const root = await stat(searchPath);
  signal.throwIfAborted();
  const directory = root.isDirectory();
  const args = ["--json", "--line-number", "--color=never", "--hidden"];
  if (context > 0) args.push("--context", String(context));
  if (params.ignoreCase) args.push("--ignore-case");
  if (params.literal) args.push("--fixed-strings");
  if (typeof params.glob === "string" && params.glob) args.push("--glob", params.glob);
  args.push("--", params.pattern, searchPath);

  const outputLines = [];
  const lineIndexes = new Map();
  let renderedBytes = 0;
  let matchCount = 0;
  let limitReached = false;
  let outputTruncated = false;
  let eventTruncated = false;
  let stderrTruncated = false;
  let linesTruncated = false;
  let finalMatch;

  try {
    await new Promise((resolve, reject) => {
      const child = spawn("rg", args, {
        env: process.env,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      activeChildren.add(child);
      const stderrParts = [];
      let stderrLength = 0;
      let settled = false;
      let killedForBound = false;

      const finish = (callback) => {
        if (settled) return;
        settled = true;
        activeChildren.delete(child);
        signal.removeEventListener("abort", onAbort);
        callback();
      };
      const stopAtBound = () => {
        if (killedForBound) return;
        killedForBound = true;
        killGroup(child, "SIGTERM");
      };
      const onAbort = () => killGroup(child);
      signal.addEventListener("abort", onAbort, { once: true });

      const addOutputLine = (filePath, lineNumber, rawText, match) => {
        const key = `${filePath}\0${lineNumber}`;
        const existingIndex = lineIndexes.get(key);
        if (existingIndex !== undefined) {
          if (match && !outputLines[existingIndex].match) outputLines[existingIndex].match = true;
          return true;
        }
        const truncated = truncateGrepLine(typeof rawText === "string" ? rawText : "(unable to read file)");
        const displayPath = escapePathForDisplay(displayGrepPath(filePath, searchPath, directory));
        const rendered = `${displayPath}${match ? ":" : "-"}${lineNumber}${match ? ":" : "-"} ${truncated.text}`;
        const candidateBytes = Buffer.byteLength(rendered, "utf8") + (outputLines.length > 0 ? 1 : 0);
        if (renderedBytes + candidateBytes > COMMAND_OUTPUT_MAX_BYTES) {
          outputTruncated = true;
          stopAtBound();
          return false;
        }
        lineIndexes.set(key, outputLines.length);
        outputLines.push({ displayPath, lineNumber, text: truncated.text, match });
        if (truncated.truncated) linesTruncated = true;
        renderedBytes += candidateBytes;
        return true;
      };

      const handleSearchEvent = (event) => {
        if (outputTruncated || eventTruncated) return;
        if (event?.type !== "match" && event?.type !== "context") return;
        const filePath = event.data?.path?.text;
        const lineNumber = event.data?.line_number;
        if (typeof filePath !== "string" || !Number.isSafeInteger(lineNumber) || lineNumber < 1) return;

        if (finalMatch) {
          if (lineIndexes.has(`${filePath}\0${lineNumber}`)) return;
          const inTrailingContext = filePath === finalMatch.filePath
            && lineNumber > finalMatch.lineNumber
            && lineNumber <= finalMatch.lineNumber + context;
          if (!inTrailingContext) {
            stopAtBound();
            return;
          }
          if (!addOutputLine(filePath, lineNumber, event.data?.lines?.text, false)) return;
          if (lineNumber >= finalMatch.lineNumber + context) stopAtBound();
          return;
        }

        if (event.type === "context") {
          addOutputLine(filePath, lineNumber, event.data?.lines?.text, false);
          return;
        }

        if (!addOutputLine(filePath, lineNumber, event.data?.lines?.text, true)) return;
        matchCount++;
        if (matchCount >= limit) {
          limitReached = true;
          finalMatch = { filePath, lineNumber };
          if (context === 0) stopAtBound();
        }
      };

      const decoder = new BoundedNewlineDecoder((frame) => {
        if (frame.length === 0) return;
        try {
          handleSearchEvent(JSON.parse(frame.toString("utf8")));
        } catch {
          // Preserve ripgrep's prior behavior for malformed individual events.
        }
      }, { maxBytes: RPC_FRAME_PAYLOAD_LIMIT });

      child.stdout.on("data", (chunk) => {
        if (eventTruncated) return;
        try {
          decoder.push(chunk);
        } catch {
          eventTruncated = true;
          stopAtBound();
        }
      });
      child.stdout.on("end", () => {
        if (killedForBound || eventTruncated) return;
        try {
          decoder.end();
        } catch {
          eventTruncated = true;
          stopAtBound();
        }
      });
      child.stderr.on("data", (chunk) => {
        if (stderrTruncated) return;
        const appended = appendBounded(stderrParts, stderrLength, chunk, COMMAND_OUTPUT_MAX_BYTES);
        stderrLength = appended.length;
        stderrTruncated = appended.truncated;
      });
      child.on("error", (error) => finish(() => reject(error)));
      child.on("close", (code) => finish(() => {
        const stderr = Buffer.concat(stderrParts, stderrLength);
        if (signal.aborted) reject(new Error("Operation aborted"));
        else if (!killedForBound && code !== 0 && code !== 1) {
          reject(new Error(captureFailureMessage("ripgrep", code, stderr, stderrTruncated, COMMAND_OUTPUT_MAX_BYTES)));
        } else resolve();
      }));
    });
  } catch (error) {
    throw operationDependencyError(error, "grep", "rg");
  }

  return {
    lines: outputLines,
    limitReached,
    limit,
    outputTruncated,
    eventTruncated,
    stderrTruncated,
    linesTruncated,
  };
}

const handlers = {
  probe,
  mutationKey: mutationKeyOperation,
  read: readOperation,
  write: writeOperation,
  ls: listOperation,
  find: findOperation,
  grep: grepOperation,
};

const protocol = createHelperProtocol({ handlers, respond });
let terminating = false;
let terminationCleanupComplete = false;

function cleanupForTermination() {
  if (terminationCleanupComplete) return;
  terminationCleanupComplete = true;
  protocol.abortAll();
  outputWriter.close();
  for (const child of activeChildren) killGroup(child);
}

function terminate(exitCode) {
  if (terminating) return;
  terminating = true;
  cleanupForTermination();
  process.stdin.destroy();
  setImmediate(() => process.exit(exitCode));
}

const terminateForProtocolFailure = () => terminate(1);

const inputDecoder = new BoundedNewlineDecoder((frame) => {
  if (frame.length === 0 || frame.toString("utf8").trim().length === 0) return;
  let message;
  try {
    message = JSON.parse(frame.toString("utf8"));
  } catch {
    terminateForProtocolFailure();
    return;
  }
  void protocol.dispatch(message).catch(terminateForProtocolFailure);
});
process.stdin.on("data", (chunk) => {
  try {
    inputDecoder.push(chunk);
  } catch {
    terminateForProtocolFailure();
  }
});
process.stdin.on("error", terminateForProtocolFailure);
process.stdin.on("end", () => {
  try {
    inputDecoder.end();
  } catch {
    terminateForProtocolFailure();
    return;
  }
  terminate(0);
});

process.once("exit", cleanupForTermination);
process.once("SIGTERM", () => terminate(0));
process.once("SIGINT", () => terminate(0));
