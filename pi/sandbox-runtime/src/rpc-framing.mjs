import { once } from "node:events";

export const RPC_FRAME_PAYLOAD_LIMIT = 1024 * 1024;
export const RPC_BINARY_CHUNK_SIZE = 64 * 1024;
export const RPC_STREAM_PAYLOAD_LIMIT = 8 * 1024 * 1024;
export const RPC_CONCURRENCY_LIMIT = 16;
export const RPC_READ_CONCURRENCY_LIMIT = 4;
export const TEXT_READ_MAX_LINES = 2000;
export const TEXT_READ_MAX_BYTES = 50 * 1024;

// Descriptive aliases are exported as well so callers do not have to depend on
// the protocol-oriented names above.
export const MAX_RPC_FRAME_BYTES = RPC_FRAME_PAYLOAD_LIMIT;
export const MAX_BINARY_CHUNK_BYTES = RPC_BINARY_CHUNK_SIZE;
export const MAX_FILE_PAYLOAD_BYTES = RPC_STREAM_PAYLOAD_LIMIT;
export const MAX_RPC_CONCURRENCY = RPC_CONCURRENCY_LIMIT;
export const MAX_READ_CONCURRENCY = RPC_READ_CONCURRENCY_LIMIT;

export const RPC_FRAME_TOO_LARGE = "RPC_FRAME_TOO_LARGE";
export const RPC_STREAM_TOO_LARGE = "RPC_STREAM_TOO_LARGE";
export const RPC_CONCURRENCY_LIMIT_CODE = "RPC_CONCURRENCY_LIMIT";
export const FILE_TOO_LARGE = "FILE_TOO_LARGE";

export class RpcLimitError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "RpcLimitError";
    this.code = code;
  }
}

function escapedJsonString(value, append) {
  append('"');
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code === 0x22) append('\\"');
    else if (code === 0x5c) append('\\\\');
    else if (code === 0x08) append('\\b');
    else if (code === 0x0c) append('\\f');
    else if (code === 0x0a) append('\\n');
    else if (code === 0x0d) append('\\r');
    else if (code === 0x09) append('\\t');
    else if (code < 0x20 || (code >= 0xd800 && code <= 0xdfff)) {
      if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
        const low = value.charCodeAt(index + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          append(value.slice(index, index + 2));
          index++;
          continue;
        }
      }
      append(`\\u${code.toString(16).padStart(4, "0")}`);
    } else append(value[index]);
  }
  append('"');
}

/** JSON.stringify for plain protocol values, aborting before output exceeds maxBytes. */
export function boundedJsonStringify(root, maxBytes = RPC_FRAME_PAYLOAD_LIMIT) {
  const parts = [];
  let current = "";
  let currentBytes = 0;
  let totalBytes = 0;
  const ancestors = new Set();
  const append = (piece) => {
    const bytes = Buffer.byteLength(piece, "utf8");
    if (totalBytes + bytes > maxBytes) {
      throw new RpcLimitError(
        `RPC frame payload exceeds the ${maxBytes}-byte maximum`,
        RPC_FRAME_TOO_LARGE,
      );
    }
    if (currentBytes + bytes > 8192 && current) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += piece;
    currentBytes += bytes;
    totalBytes += bytes;
  };

  const serialize = (input, inArray = false) => {
    let value = input;
    if (value && typeof value === "object" && typeof value.toJSON === "function") value = value.toJSON();
    if (value === null) {
      append("null");
      return true;
    }
    switch (typeof value) {
      case "string":
        escapedJsonString(value, append);
        return true;
      case "number":
        append(Number.isFinite(value) ? String(value) : "null");
        return true;
      case "boolean":
        append(value ? "true" : "false");
        return true;
      case "bigint":
        throw new TypeError("Do not know how to serialize a BigInt");
      case "undefined":
      case "function":
      case "symbol":
        if (inArray) {
          append("null");
          return true;
        }
        return false;
      case "object":
        break;
      default:
        return false;
    }

    if (ancestors.has(value)) throw new TypeError("Converting circular structure to JSON");
    ancestors.add(value);
    if (Array.isArray(value)) {
      append("[");
      for (let index = 0; index < value.length; index++) {
        if (index > 0) append(",");
        serialize(value[index], true);
      }
      append("]");
    } else {
      append("{");
      let first = true;
      for (const key of Object.keys(value)) {
        const property = value[key];
        if (property === undefined || typeof property === "function" || typeof property === "symbol") continue;
        if (!first) append(",");
        first = false;
        escapedJsonString(key, append);
        append(":");
        serialize(property, false);
      }
      append("}");
    }
    ancestors.delete(value);
    return true;
  };

  if (!serialize(root, false)) return undefined;
  if (current) parts.push(current);
  return { json: parts.join(""), bytes: totalBytes };
}

export function encodeRpcFrame(message, maxBytes = RPC_FRAME_PAYLOAD_LIMIT) {
  let serialized;
  try {
    serialized = boundedJsonStringify(message, maxBytes);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === RPC_FRAME_TOO_LARGE) throw error;
    throw new Error(`Could not serialize RPC frame: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (serialized === undefined) throw new Error("Could not serialize RPC frame");
  const payload = Buffer.from(serialized.json, "utf8");
  const frame = Buffer.allocUnsafe(serialized.bytes + 1);
  payload.copy(frame);
  frame[serialized.bytes] = 0x0a;
  return frame;
}

/**
 * A byte-counting newline decoder. It never concatenates an incomplete frame
 * after that frame has crossed the configured limit.
 */
export class BoundedNewlineDecoder {
  constructor(onFrame, options = {}) {
    this.onFrame = onFrame;
    this.maxBytes = options.maxBytes ?? RPC_FRAME_PAYLOAD_LIMIT;
    this.parts = [];
    this.length = 0;
    this.failed = false;
  }

  push(value) {
    if (this.failed) return;
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    let offset = 0;
    while (offset < chunk.length) {
      const newline = chunk.indexOf(0x0a, offset);
      const end = newline === -1 ? chunk.length : newline;
      const partLength = end - offset;
      if (this.length + partLength > this.maxBytes) {
        this.failed = true;
        this.parts = [];
        this.length = 0;
        throw new RpcLimitError(
          `RPC frame payload exceeds the ${this.maxBytes}-byte maximum`,
          RPC_FRAME_TOO_LARGE,
        );
      }
      if (partLength > 0) {
        this.parts.push(chunk.subarray(offset, end));
        this.length += partLength;
      }
      if (newline === -1) return;

      const frame = this.length === 0
        ? Buffer.alloc(0)
        : this.parts.length === 1
          ? this.parts[0]
          : Buffer.concat(this.parts, this.length);
      this.parts = [];
      this.length = 0;
      this.onFrame(frame);
      if (this.failed) return;
      offset = newline + 1;
    }
  }

  end() {
    if (this.failed) return;
    if (this.length !== 0) {
      this.failed = true;
      this.parts = [];
      this.length = 0;
      throw new Error("RPC stream ended with an incomplete frame");
    }
  }

  get bufferedBytes() {
    return this.length;
  }
}

/**
 * Serialize writes and wait for both the write callback and drain when the
 * writable applies backpressure. Messages are encoded only when they reach the
 * front of the queue, so queued calls do not retain serialized frame copies.
 */
export class RpcFrameWriter {
  constructor(writable, options = {}) {
    this.writable = writable;
    this.maxBytes = options.maxBytes ?? RPC_FRAME_PAYLOAD_LIMIT;
    this.tail = Promise.resolve();
    this.closedError = undefined;
    this.currentReject = undefined;

    this.onError = (error) => {
      this.fail(error instanceof Error ? error : new Error(String(error)));
    };
    this.onClose = () => {
      this.fail(new Error("RPC writable closed"));
    };
    writable.on("error", this.onError);
    writable.on("close", this.onClose);
  }

  write(message) {
    const operation = this.tail.then(() => this.writeOne(message));
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  async writeOne(message) {
    if (this.closedError || this.writable.destroyed || this.writable.writableEnded) {
      throw this.closedError ?? new Error("RPC writable is not available");
    }
    const frame = encodeRpcFrame(message, this.maxBytes);
    await new Promise((resolve, reject) => {
      let callbackDone = false;
      let drainDone = true;
      let settled = false;
      const cleanup = () => {
        if (this.currentReject === rejectCurrent) this.currentReject = undefined;
        this.writable.removeListener("drain", onDrain);
      };
      const finish = () => {
        if (settled || !callbackDone || !drainDone) return;
        settled = true;
        cleanup();
        resolve();
      };
      const rejectCurrent = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const onDrain = () => {
        drainDone = true;
        finish();
      };
      this.currentReject = rejectCurrent;

      let accepted;
      try {
        accepted = this.writable.write(frame, (error) => {
          queueMicrotask(() => {
            if (error) {
              rejectCurrent(error);
              return;
            }
            callbackDone = true;
            finish();
          });
        });
      } catch (error) {
        rejectCurrent(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      if (!accepted && !settled) {
        drainDone = false;
        this.writable.once("drain", onDrain);
      }
    });
  }

  fail(error = new Error("RPC writable stopped")) {
    if (!this.closedError) this.closedError = error;
    this.currentReject?.(this.closedError);
  }

  close(error = new Error("RPC writable stopped")) {
    this.fail(error);
  }
}

export function encodeBinaryChunk(bytes) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (bytes.length > RPC_BINARY_CHUNK_SIZE) {
    throw new RpcLimitError(
      `Binary RPC chunk is ${bytes.length} bytes; maximum is ${RPC_BINARY_CHUNK_SIZE} bytes`,
      RPC_STREAM_TOO_LARGE,
    );
  }
  return bytes.toString("base64");
}

/** Strict base64 decoding for protocol chunks. */
export function decodeBinaryChunk(value) {
  if (typeof value !== "string" || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("RPC binary stream contains invalid base64");
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length > RPC_BINARY_CHUNK_SIZE) {
    throw new Error(`RPC binary stream chunk exceeds ${RPC_BINARY_CHUNK_SIZE} bytes`);
  }
  return decoded;
}

/** Wait for a writable's buffered bytes to drain without writing a frame. */
export async function waitForDrain(writable) {
  if (!writable.writableNeedDrain) return;
  await once(writable, "drain");
}
