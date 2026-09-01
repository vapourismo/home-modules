import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ImageContent, TextContent } from "@earendil-works/pi-ai";
import {
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatDimensionNote,
  formatSize,
  generateDiffString,
  generateUnifiedPatch,
  renderDiff,
  resizeImage,
  convertToPng,
  truncateHead,
  withFileMutationQueue,
  type EditToolInput,
  type GrepToolDetails,
  type GrepToolInput,
  type ReadToolDetails,
} from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { applyExactEdits } from "./edit.ts";
import { AbortableLimiter } from "./limiter.ts";
import { compareLsNames } from "./ls-selection.mjs";
import { escapePathForDisplay } from "./path-display.mjs";
import { readPathCandidates, resolveSyntacticPath } from "./paths.ts";
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
} from "./search-limits.mjs";
import {
  FILE_TOO_LARGE,
  HelperRpcClient,
  HelperRpcError,
  RPC_READ_CONCURRENCY_LIMIT,
  RPC_STREAM_PAYLOAD_LIMIT,
  RPC_STREAM_TOO_LARGE,
  type HelperBinaryResult,
} from "./rpc.ts";

export type RpcProvider = () => Promise<HelperRpcClient>;

interface HelperTextTruncation {
  truncated: true;
  truncatedBy: "lines" | "bytes";
  totalLines: number;
  totalBytes: number;
  outputLines: number;
  outputBytes: number;
  lastLinePartial: false;
  firstLineExceedsLimit: boolean;
  maxLines: number;
  maxBytes: number;
}

interface HelperTextReadMetadata {
  kind: "text";
  path: string;
  mimeType: null;
  startLine: number;
  totalFileLines?: number;
  exactTotal: boolean;
  hasMore: boolean;
  nextOffset?: number;
  userLimitedLines?: number;
  outputLines: number;
  truncated: boolean;
  truncatedBy: "lines" | "bytes" | null;
  truncation?: HelperTextTruncation;
  firstLineExceedsLimit: boolean;
  firstLineBytes?: number;
}

interface HelperImageReadMetadata {
  kind: "image";
  path: string;
  mimeType: string;
}

interface HelperFullReadMetadata {
  kind: "full";
  path: string;
  mimeType: string | null;
}

type HelperReadMetadata = HelperTextReadMetadata | HelperImageReadMetadata | HelperFullReadMetadata;

interface HelperLsResult {
  entries: Array<{ name: string; directory: boolean }>;
  limitReached: boolean;
  limit: number;
}

interface HelperFindResult {
  paths: string[];
  limit: number;
  limitReached: boolean;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

interface HelperGrepLine {
  displayPath: string;
  lineNumber: number;
  text: string;
  match: boolean;
}

interface HelperGrepResult {
  lines: HelperGrepLine[];
  limitReached: boolean;
  limit: number;
  outputTruncated: boolean;
  eventTruncated: boolean;
  stderrTruncated: boolean;
  linesTruncated: boolean;
}

type HelperMutationKeyResult =
  | { available: true; key: string }
  | { available: false };

type MutationGateMode = "shared" | "exclusive";

interface MutationGateWaiter {
  mode: MutationGateMode;
  resolve: () => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

class FairMutationGate {
  private activeShared = 0;
  private activeExclusive = false;
  private readonly waiters: MutationGateWaiter[] = [];

  async run<T>(mode: MutationGateMode, signal: AbortSignal | undefined, task: () => Promise<T>): Promise<T> {
    await this.acquire(mode, signal);
    try {
      return await task();
    } finally {
      if (mode === "shared") this.activeShared--;
      else this.activeExclusive = false;
      this.drain();
    }
  }

  private acquire(mode: MutationGateMode, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(new Error("Operation aborted"));
    return new Promise<void>((resolve, reject) => {
      const waiter: MutationGateWaiter = { mode, resolve, reject, signal };
      waiter.onAbort = () => {
        const index = this.waiters.indexOf(waiter);
        if (index === -1) return;
        this.waiters.splice(index, 1);
        reject(new Error("Operation aborted"));
        this.drain();
      };
      signal?.addEventListener("abort", waiter.onAbort, { once: true });
      this.waiters.push(waiter);
      this.drain();
    });
  }

  private grant(waiter: MutationGateWaiter): void {
    if (waiter.signal && waiter.onAbort) waiter.signal.removeEventListener("abort", waiter.onAbort);
    if (waiter.mode === "shared") this.activeShared++;
    else this.activeExclusive = true;
    waiter.resolve();
  }

  private drain(): void {
    if (this.activeExclusive || this.waiters.length === 0) return;
    const first = this.waiters[0]!;
    if (first.mode === "exclusive") {
      if (this.activeShared > 0) return;
      this.waiters.shift();
      this.grant(first);
      return;
    }
    while (this.waiters[0]?.mode === "shared") this.grant(this.waiters.shift()!);
  }
}

const MUTATION_FALLBACK_QUEUE_KEY = path.join(
  tmpdir(),
  `.pi-sandbox-runtime-${process.pid}-${randomUUID()}`,
  "mutation-fallback",
);

async function request<T>(provider: RpcProvider, method: string, params: unknown, signal?: AbortSignal): Promise<T> {
  const rpc = await provider();
  return rpc.request<T>(method, params, signal);
}

async function resolveMutationKey(
  provider: RpcProvider,
  absolutePath: string,
  signal?: AbortSignal,
): Promise<HelperMutationKeyResult> {
  const result = await request<unknown>(provider, "mutationKey", { path: absolutePath }, signal);
  if (signal?.aborted) throw new Error("Operation aborted");
  if (!result || typeof result !== "object" || !("available" in result)) {
    throw new Error("Sandbox helper returned an invalid mutation key");
  }
  const candidate = result as { available?: unknown; key?: unknown };
  if (candidate.available === false) return { available: false };
  if (candidate.available === true && typeof candidate.key === "string" && path.isAbsolute(candidate.key)) {
    return { available: true, key: candidate.key };
  }
  throw new Error("Sandbox helper returned an invalid mutation key");
}

async function runSandboxMutation<T>(
  provider: RpcProvider,
  gate: FairMutationGate,
  absolutePath: string,
  signal: AbortSignal | undefined,
  task: () => Promise<T>,
): Promise<T> {
  const mutationKey = await resolveMutationKey(provider, absolutePath, signal);
  if (mutationKey.available) {
    return gate.run("shared", signal, () => withFileMutationQueue(mutationKey.key, task));
  }
  return gate.run("exclusive", signal, () => withFileMutationQueue(MUTATION_FALLBACK_QUEUE_KEY, task));
}

async function processSandboxImage(
  data: Buffer,
  mimeType: string,
): Promise<{ ok: true; data: string; mimeType: string; hints: string[] } | { ok: false; message: string }> {
  let bytes = data;
  let normalizedMime = mimeType;
  const hints: string[] = [];
  if (mimeType === "image/bmp") {
    // The conversion API accepts base64; all other image paths keep the
    // streamed Buffer and avoid a decode/re-encode cycle.
    const converted = await convertToPng(data.toString("base64"), mimeType);
    if (!converted) return { ok: false, message: "[Image omitted: could not be converted to a supported inline image format.]" };
    bytes = Buffer.from(converted.data, "base64");
    normalizedMime = converted.mimeType;
    hints.push(`[Image converted from ${mimeType} to ${normalizedMime}.]`);
  }
  const resized = await resizeImage(bytes, normalizedMime);
  if (!resized) return { ok: false, message: "[Image omitted: could not be resized below the inline image size limit.]" };
  const dimensionNote = formatDimensionNote(resized);
  if (dimensionNote) hints.push(dimensionNote);
  return { ok: true, data: resized.data, mimeType: resized.mimeType, hints };
}

function nonVisionNote(ctx: any): string | undefined {
  return !ctx?.model || ctx.model.input.includes("image")
    ? undefined
    : "[Current model does not support images. The image will be omitted from this request.]";
}

async function executeRead(
  provider: RpcProvider,
  cwd: string,
  params: { path: string; offset?: number; limit?: number },
  signal: AbortSignal | undefined,
  ctx: any,
): Promise<{ content: Array<TextContent | ImageContent>; details: ReadToolDetails | undefined }> {
  const rpc = await provider();
  const result = await rpc.requestBinary<HelperReadMetadata>("read", {
    paths: readPathCandidates(params.path, cwd),
    offset: params.offset,
    limit: params.limit,
  }, signal);
  if (signal?.aborted) throw new Error("Operation aborted");
  const metadata = result.metadata;
  if (!metadata || typeof metadata !== "object" || !("kind" in metadata)) {
    throw new Error("Sandbox helper returned invalid read metadata");
  }

  if (metadata.kind === "image") {
    const processed = await processSandboxImage(result.data, metadata.mimeType);
    if (signal?.aborted) throw new Error("Operation aborted");
    const modelNote = nonVisionNote(ctx);
    if (!processed.ok) {
      let text = `Read image file [${metadata.mimeType}]\n${processed.message}`;
      if (modelNote) text += `\n${modelNote}`;
      return { content: [{ type: "text", text }], details: undefined };
    }
    let text = `Read image file [${processed.mimeType}]`;
    if (processed.hints.length) text += `\n${processed.hints.join("\n")}`;
    if (modelNote) text += `\n${modelNote}`;
    return {
      content: [
        { type: "text", text },
        { type: "image", data: processed.data, mimeType: processed.mimeType },
      ],
      details: undefined,
    };
  }
  if (metadata.kind !== "text") throw new Error("Sandbox helper returned an unexpected full-file read");

  const textContent = result.data.toString("utf8");
  const startLineDisplay = metadata.startLine;
  const exactTruncation = metadata.truncation
    ? { ...metadata.truncation, content: textContent }
    : undefined;
  let outputText: string;
  let details: ReadToolDetails | undefined;
  if (metadata.firstLineExceedsLimit) {
    const sizeDescription = metadata.firstLineBytes === undefined
      ? `larger than ${formatSize(DEFAULT_MAX_BYTES)}`
      : `${formatSize(metadata.firstLineBytes)}, exceeds ${formatSize(DEFAULT_MAX_BYTES)}`;
    outputText = `[Line ${startLineDisplay} is ${sizeDescription} limit. Use bash: sed -n '${startLineDisplay}p' ${params.path} | head -c ${DEFAULT_MAX_BYTES}]`;
    details = exactTruncation ? { truncation: exactTruncation as any } : undefined;
  } else if (metadata.truncated) {
    const endLineDisplay = startLineDisplay + metadata.outputLines - 1;
    const nextOffset = metadata.nextOffset ?? endLineDisplay + 1;
    const totalDescription = metadata.totalFileLines === undefined
      ? "a larger file"
      : String(metadata.totalFileLines);
    outputText = textContent;
    outputText += metadata.truncatedBy === "lines"
      ? `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalDescription}. Use offset=${nextOffset} to continue.]`
      : `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalDescription} (${formatSize(DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
    details = exactTruncation ? { truncation: exactTruncation as any } : undefined;
  } else if (metadata.userLimitedLines !== undefined && metadata.hasMore) {
    const nextOffset = metadata.nextOffset ?? startLineDisplay + metadata.userLimitedLines;
    if (metadata.totalFileLines !== undefined) {
      const consumed = startLineDisplay - 1 + metadata.userLimitedLines;
      const remaining = Math.max(0, metadata.totalFileLines - consumed);
      outputText = `${textContent}\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
    } else {
      outputText = `${textContent}\n\n[More lines in file. Use offset=${nextOffset} to continue.]`;
    }
  } else {
    outputText = textContent;
  }
  return { content: [{ type: "text", text: outputText }], details };
}

function relativizeFindResult(resultPath: string, searchPath: string): string {
  const hadTrailingSeparator = resultPath.endsWith("/");
  const relative = path.isAbsolute(resultPath) ? path.relative(searchPath, resultPath) : resultPath;
  return hadTrailingSeparator && !relative.endsWith("/") ? `${relative}/` : relative;
}

async function executeGrep(
  provider: RpcProvider,
  cwd: string,
  params: GrepToolInput,
  signal?: AbortSignal,
): Promise<{ content: TextContent[]; details: GrepToolDetails | undefined }> {
  const limit = validateIntegerParameter(params.limit, {
    name: "grep limit",
    defaultValue: GREP_DEFAULT_LIMIT,
    minimum: 1,
    maximum: GREP_MAX_LIMIT,
  });
  const context = validateIntegerParameter(params.context, {
    name: "grep context",
    defaultValue: GREP_DEFAULT_CONTEXT,
    minimum: 0,
    maximum: GREP_MAX_CONTEXT,
  });
  const searchPath = resolveSyntacticPath(params.path ?? ".", cwd);
  const result = await request<HelperGrepResult>(provider, "grep", {
    ...params,
    path: searchPath,
    limit,
    context,
  }, signal);

  const outputLines = result.lines.map((line) =>
    `${line.displayPath}${line.match ? ":" : "-"}${line.lineNumber}${line.match ? ":" : "-"} ${line.text}`);
  const details: GrepToolDetails & Record<string, unknown> = {};
  const notices: string[] = [];
  if (result.limitReached) {
    details.matchLimitReached = result.limit;
    notices.push(`${result.limit} matches maximum reached; refine the path or pattern`);
  }
  if (result.outputTruncated) {
    details.outputTruncated = true;
    notices.push(`${formatSize(COMMAND_OUTPUT_MAX_BYTES)} helper output limit reached; refine the path or pattern`);
  }
  if (result.eventTruncated) {
    details.eventTruncated = true;
    notices.push("An oversized ripgrep event was discarded; refine the path or pattern");
  }
  if (result.stderrTruncated) {
    details.stderrTruncated = true;
    notices.push(`Ripgrep diagnostics were truncated at ${formatSize(COMMAND_OUTPUT_MAX_BYTES)}`);
  }
  if (result.linesTruncated) {
    details.linesTruncated = true;
    notices.push("Some lines truncated; use read to see full lines");
  }
  let output = outputLines.length ? outputLines.join("\n") : "No matches found";
  if (notices.length) output += `\n\n[${notices.join(". ")}]`;
  return { content: [{ type: "text", text: output }], details: Object.keys(details).length ? details : undefined };
}

export function createSandboxToolDefinitions(cwd: string, provider: RpcProvider) {
  const readLimiter = new AbortableLimiter(RPC_READ_CONCURRENCY_LIMIT);
  const mutationGate = new FairMutationGate();
  const readBase = createReadToolDefinition(cwd);
  const writeBase = createWriteToolDefinition(cwd);
  const editBase = createEditToolDefinition(cwd);
  const lsBase = createLsToolDefinition(cwd);
  const findBase = createFindToolDefinition(cwd);
  const grepBase = createGrepToolDefinition(cwd);
  const lsParameters = Type.Object({
    ...lsBase.parameters.properties,
    limit: Type.Optional(Type.Integer({
      minimum: 1,
      maximum: LS_MAX_LIMIT,
      description: `Maximum number of entries to return (default and hard maximum: ${LS_DEFAULT_LIMIT})`,
    })),
  });
  const findParameters = Type.Object({
    ...findBase.parameters.properties,
    limit: Type.Optional(Type.Integer({
      minimum: 1,
      maximum: FIND_MAX_LIMIT,
      description: `Maximum number of results (default and hard maximum: ${FIND_DEFAULT_LIMIT})`,
    })),
  });
  const grepParameters = Type.Object({
    ...grepBase.parameters.properties,
    context: Type.Optional(Type.Integer({
      minimum: 0,
      maximum: GREP_MAX_CONTEXT,
      description: `Lines before and after each match (default: ${GREP_DEFAULT_CONTEXT}, maximum: ${GREP_MAX_CONTEXT})`,
    })),
    limit: Type.Optional(Type.Integer({
      minimum: 1,
      maximum: GREP_MAX_LIMIT,
      description: `Maximum number of matches (default and hard maximum: ${GREP_DEFAULT_LIMIT})`,
    })),
  });

  return {
    read: {
      ...readBase,
      async execute(_id: string, params: any, signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
        return readLimiter.run(signal, () => executeRead(provider, ctx?.cwd ?? cwd, params, signal, ctx));
      },
    },
    write: {
      ...writeBase,
      async execute(_id: string, params: any, signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
        const absolutePath = resolveSyntacticPath(params.path, ctx?.cwd ?? cwd);
        return runSandboxMutation(provider, mutationGate, absolutePath, signal, async () => {
          if (signal?.aborted) throw new Error("Operation aborted");
          const body = Buffer.from(params.content, "utf8");
          if (body.length > RPC_STREAM_PAYLOAD_LIMIT) {
            throw new HelperRpcError(
              `Write body is ${body.length} bytes; maximum is ${RPC_STREAM_PAYLOAD_LIMIT} bytes`,
              RPC_STREAM_TOO_LARGE,
            );
          }
          const rpc = await provider();
          await rpc.requestWithBody("write", { path: absolutePath }, body, signal);
          return {
            content: [{ type: "text", text: `Successfully wrote ${body.length} bytes to ${params.path}` }],
            details: undefined,
          };
        });
      },
    },
    edit: {
      ...editBase,
      renderShell: undefined,
      async execute(_id: string, params: EditToolInput, signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
        const absolutePath = resolveSyntacticPath(params.path, ctx?.cwd ?? cwd);
        return runSandboxMutation(provider, mutationGate, absolutePath, signal, () => readLimiter.run(signal, async () => {
          if (signal?.aborted) throw new Error("Operation aborted");
          let readResult: HelperBinaryResult<HelperFullReadMetadata>;
          try {
            const rpc = await provider();
            readResult = await rpc.requestBinary<HelperFullReadMetadata>(
              "read",
              { paths: [absolutePath], mode: "full" },
              signal,
            );
          } catch (error) {
            if (error instanceof HelperRpcError && error.code === FILE_TOO_LARGE) throw error;
            throw new Error(`Could not edit file: ${params.path}. ${error instanceof Error ? error.message : String(error)}.`);
          }
          if (readResult.metadata?.kind !== "full") throw new Error("Sandbox helper returned invalid edit-read metadata");
          const rawContent = readResult.data.toString("utf8");
          const applied = applyExactEdits(rawContent, params.edits, params.path);
          if (signal?.aborted) throw new Error("Operation aborted");
          const body = Buffer.from(applied.finalContent, "utf8");
          if (body.length > RPC_STREAM_PAYLOAD_LIMIT) {
            throw new HelperRpcError(
              `Edited file is ${body.length} bytes; maximum is ${RPC_STREAM_PAYLOAD_LIMIT} bytes`,
              RPC_STREAM_TOO_LARGE,
            );
          }
          const rpc = await provider();
          await rpc.requestWithBody("write", { path: absolutePath }, body, signal);
          const diffResult = generateDiffString(applied.baseContent, applied.newContent);
          const patch = generateUnifiedPatch(params.path, applied.baseContent, applied.newContent);
          return {
            content: [{ type: "text", text: `Successfully replaced ${params.edits.length} block(s) in ${params.path}.` }],
            details: { diff: diffResult.diff, patch, firstChangedLine: diffResult.firstChangedLine },
          };
        }));
      },
      renderCall(args: any, theme: any, context: any) {
        const component = context.lastComponent instanceof Text ? context.lastComponent : new Text("", 0, 0);
        const rawPath = typeof args?.path === "string" ? args.path : "";
        component.setText(`${theme.fg("toolTitle", theme.bold("edit"))} ${theme.fg("accent", rawPath)}`);
        return component;
      },
      renderResult(result: any, _options: any, theme: any, context: any) {
        const component = context.lastComponent instanceof Container ? context.lastComponent : new Container();
        component.clear();
        if (context.isError) {
          const output = result.content?.filter((entry: any) => entry.type === "text").map((entry: any) => entry.text).join("\n");
          if (output) component.addChild(new Text(theme.fg("error", output), 0, 0));
        } else if (result.details?.diff) {
          component.addChild(new Spacer(1));
          component.addChild(new Text(renderDiff(result.details.diff, { filePath: context.args?.path }), 0, 0));
        }
        return component;
      },
    },
    ls: {
      ...lsBase,
      parameters: lsParameters,
      description: `List directory contents. Returns entries sorted alphabetically (case-insensitively), with '/' suffixes for directories. Includes dotfiles. The hard maximum is ${LS_MAX_LIMIT} entries; rendered output is bounded to ${formatSize(COMMAND_OUTPUT_MAX_BYTES)}.`,
      async execute(_id: string, params: any, signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
        const effectiveLimit = validateIntegerParameter(params.limit, {
          name: "ls limit",
          defaultValue: LS_DEFAULT_LIMIT,
          minimum: 1,
          maximum: LS_MAX_LIMIT,
        });
        const dirPath = resolveSyntacticPath(params.path ?? ".", ctx?.cwd ?? cwd);
        const result = await request<HelperLsResult>(provider, "ls", {
          path: dirPath,
          limit: effectiveLimit,
        }, signal);
        result.entries.sort((left, right) => compareLsNames(left.name, right.name));
        if (!result.entries.length) return { content: [{ type: "text", text: "(empty directory)" }], details: undefined };
        const truncation = truncateHead(result.entries.map((entry) =>
          `${escapePathForDisplay(entry.name)}${entry.directory ? "/" : ""}`).join("\n"), {
          maxLines: Number.MAX_SAFE_INTEGER,
          maxBytes: COMMAND_OUTPUT_MAX_BYTES,
        });
        const details: any = {};
        const notices: string[] = [];
        if (result.limitReached) {
          details.entryLimitReached = result.limit;
          notices.push(`${result.limit} entries maximum reached; refine the path`);
        }
        if (truncation.truncated) {
          details.truncation = truncation;
          notices.push(`${formatSize(COMMAND_OUTPUT_MAX_BYTES)} output limit reached; refine the path`);
        }
        let output = truncation.content;
        if (notices.length) output += `\n\n[${notices.join(". ")}]`;
        return { content: [{ type: "text", text: output }], details: Object.keys(details).length ? details : undefined };
      },
    },
    find: {
      ...findBase,
      parameters: findParameters,
      description: `Search for files by glob pattern. Returns matching file paths relative to the search directory. Respects .gitignore. The hard maximum is ${FIND_MAX_LIMIT} results. Helper capture is bounded to ${formatSize(COMMAND_OUTPUT_MAX_BYTES)}, and rendered output is also bounded to ${formatSize(COMMAND_OUTPUT_MAX_BYTES)}.`,
      async execute(_id: string, params: any, signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
        const effectiveLimit = validateIntegerParameter(params.limit, {
          name: "find limit",
          defaultValue: FIND_DEFAULT_LIMIT,
          minimum: 1,
          maximum: FIND_MAX_LIMIT,
        });
        const searchPath = resolveSyntacticPath(params.path ?? ".", ctx?.cwd ?? cwd);
        const result = await request<HelperFindResult>(provider, "find", {
          pattern: params.pattern,
          path: searchPath,
          limit: effectiveLimit,
        }, signal);
        const displayed = result.paths.map((entry) =>
          escapePathForDisplay(relativizeFindResult(entry, searchPath)));
        const truncation = truncateHead(displayed.join("\n"), {
          maxLines: Number.MAX_SAFE_INTEGER,
          maxBytes: COMMAND_OUTPUT_MAX_BYTES,
        });
        const details: any = {};
        const notices: string[] = [];
        if (result.limitReached) {
          details.resultLimitReached = result.limit;
          notices.push(`${result.limit} results maximum reached; refine the path or pattern`);
        }
        if (result.stdoutTruncated) {
          details.stdoutTruncated = true;
          notices.push(`${formatSize(COMMAND_OUTPUT_MAX_BYTES)} helper output limit reached; refine the path or pattern`);
        }
        if (result.stderrTruncated) {
          details.stderrTruncated = true;
          notices.push(`fd diagnostics were truncated at ${formatSize(COMMAND_OUTPUT_MAX_BYTES)}`);
        }
        if (truncation.truncated) {
          details.truncation = truncation;
          notices.push(`${formatSize(COMMAND_OUTPUT_MAX_BYTES)} rendered output limit reached; refine the path or pattern`);
        }
        let output = displayed.length ? truncation.content : "No files found matching pattern";
        if (notices.length) output += `\n\n[${notices.join(". ")}]`;
        return { content: [{ type: "text", text: output }], details: Object.keys(details).length ? details : undefined };
      },
    },
    grep: {
      ...grepBase,
      parameters: grepParameters,
      description: `Search file contents for a pattern. Returns matching lines with file paths and line numbers. Respects .gitignore. Supports up to ${GREP_MAX_CONTEXT} context lines per side. The hard maximum is ${GREP_MAX_LIMIT} matches; rendered output is bounded to ${formatSize(COMMAND_OUTPUT_MAX_BYTES)}, and each retained line is limited to ${GREP_MAX_LINE_LENGTH} characters.`,
      async execute(_id: string, params: GrepToolInput, signal: AbortSignal | undefined, _onUpdate: any, ctx: any) {
        return executeGrep(provider, ctx?.cwd ?? cwd, params, signal);
      },
    },
  };
}

export const BUILTIN_DEFAULT_LIMITS = {
  bytes: DEFAULT_MAX_BYTES,
  lines: DEFAULT_MAX_LINES,
};
