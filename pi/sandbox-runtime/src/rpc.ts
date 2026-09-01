import type { ChildProcessWithoutNullStreams } from "node:child_process";
import {
  BoundedNewlineDecoder,
  FILE_TOO_LARGE,
  MAX_BINARY_CHUNK_BYTES,
  MAX_FILE_PAYLOAD_BYTES,
  MAX_READ_CONCURRENCY,
  MAX_RPC_CONCURRENCY,
  MAX_RPC_FRAME_BYTES,
  RPC_BINARY_CHUNK_SIZE,
  RPC_CONCURRENCY_LIMIT,
  RPC_CONCURRENCY_LIMIT_CODE,
  RPC_FRAME_PAYLOAD_LIMIT,
  RPC_FRAME_TOO_LARGE,
  RPC_READ_CONCURRENCY_LIMIT,
  RPC_STREAM_PAYLOAD_LIMIT,
  RPC_STREAM_TOO_LARGE,
  TEXT_READ_MAX_BYTES,
  TEXT_READ_MAX_LINES,
  RpcFrameWriter,
  decodeBinaryChunk,
  encodeBinaryChunk,
} from "./rpc-framing.mjs";

export {
  FILE_TOO_LARGE,
  MAX_BINARY_CHUNK_BYTES,
  MAX_FILE_PAYLOAD_BYTES,
  MAX_READ_CONCURRENCY,
  MAX_RPC_CONCURRENCY,
  MAX_RPC_FRAME_BYTES,
  RPC_BINARY_CHUNK_SIZE,
  RPC_CONCURRENCY_LIMIT,
  RPC_CONCURRENCY_LIMIT_CODE,
  RPC_FRAME_PAYLOAD_LIMIT,
  RPC_FRAME_TOO_LARGE,
  RPC_READ_CONCURRENCY_LIMIT,
  RPC_STREAM_PAYLOAD_LIMIT,
  RPC_STREAM_TOO_LARGE,
  TEXT_READ_MAX_BYTES,
  TEXT_READ_MAX_LINES,
};

interface PendingRequest {
  kind: "simple" | "binary" | "upload";
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
  cancellationRequested: boolean;
  streamStarted?: boolean;
  streamBuffer?: Buffer;
  streamOffset?: number;
  streamMetadata?: unknown;
}

interface HelperResponse {
  id?: string | number;
  result?: unknown;
  error?: { message?: string; code?: string };
  cancelled?: boolean;
  stream?: { size?: unknown; metadata?: unknown };
  chunk?: unknown;
}

export interface HelperBinaryResult<TMetadata = unknown, TResult = unknown> {
  data: Buffer;
  metadata: TMetadata;
  result: TResult;
}

function operationAbortedError(): Error {
  return new Error("Operation aborted");
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export class HelperRpcError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "HelperRpcError";
    this.code = code;
  }
}

export class HelperRpcClient {
  private nextId = 1;
  private readonly pending = new Map<string, PendingRequest>();
  private closed = false;
  private intentionalClose = false;
  private unexpectedReported = false;
  private shutdownPromise: Promise<void> | undefined;
  private finishShutdownWait: (() => void) | undefined;
  private readonly decoder: BoundedNewlineDecoder;
  private readonly writer: RpcFrameWriter;
  readonly child: ChildProcessWithoutNullStreams;
  private readonly onUnexpectedExit: ((error: Error) => void) | undefined;

  constructor(
    child: ChildProcessWithoutNullStreams,
    onUnexpectedExit?: (error: Error) => void,
  ) {
    this.child = child;
    this.onUnexpectedExit = onUnexpectedExit;
    this.writer = new RpcFrameWriter(child.stdin);
    this.decoder = new BoundedNewlineDecoder((frame: Buffer) => this.consumeFrame(frame));

    child.stdout.on("data", (chunk: Buffer | string) => {
      try {
        this.decoder.push(chunk);
      } catch (error) {
        this.failProtocol(this.protocolError(error));
      }
    });
    child.stdout.on("end", () => {
      if (this.closed) return;
      try {
        this.decoder.end();
      } catch (error) {
        this.failProtocol(this.protocolError(error));
        return;
      }
      this.failProtocol(new Error("Sandbox helper stdout closed"));
    });
    child.stdout.on("error", (error) => this.failProtocol(new Error(`Sandbox helper stdout error: ${error.message}`)));
    child.stdin.on("error", (error) => this.failProtocol(new Error(`Sandbox helper stdin error: ${error.message}`)));
    child.stdin.on("close", () => {
      if (!this.closed) this.failProtocol(new Error("Sandbox helper stdin closed"));
    });
    child.stderr.on("data", () => {
      // Helper stderr is intentionally not forwarded: RPC errors carry safe,
      // request-scoped messages and sandbox violations are reported by callers.
    });
    child.stderr.on("error", () => {
      // A stderr failure must not become an unhandled stream error. Child exit
      // or the RPC pipes remain authoritative for request settlement.
    });
    child.on("error", (error) => {
      this.failProtocol(new Error(`Sandbox helper error: ${error.message}`));
      // An error event itself completes the bounded shutdown wait. A listener
      // added while this event is being emitted would otherwise miss it.
      this.finishShutdownWait?.();
    });
    child.on("exit", (code, signal) => {
      const error = new Error(`Sandbox helper exited (${signal ? `signal ${signal}` : `code ${code ?? "unknown"}`})`);
      this.failAll(error);
      if (!this.intentionalClose) this.reportUnexpected(error);
      this.finishShutdownWait?.();
    });
  }

  private protocolError(error: unknown): Error {
    if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === RPC_FRAME_TOO_LARGE) {
      return new HelperRpcError(
        `Sandbox helper emitted an RPC frame larger than ${RPC_FRAME_PAYLOAD_LIMIT} bytes`,
        RPC_FRAME_TOO_LARGE,
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  private consumeFrame(frame: Buffer): void {
    if (frame.length === 0 || frame.toString("utf8").trim().length === 0) return;
    let message: HelperResponse;
    try {
      message = JSON.parse(frame.toString("utf8"));
    } catch {
      throw new Error("Sandbox helper emitted malformed RPC JSON");
    }
    if (!message || typeof message !== "object" || Array.isArray(message) || message.id === undefined) {
      throw new Error("Sandbox helper emitted a malformed RPC message");
    }

    const isStreamStart = hasOwn(message, "stream");
    const isChunk = hasOwn(message, "chunk");
    const isError = hasOwn(message, "error");
    const isCancelled = message.cancelled === true;
    const isResult = hasOwn(message, "result");
    const categoryCount = Number(isStreamStart) + Number(isChunk) + Number(isError) + Number(isCancelled) + Number(isResult);
    if (categoryCount !== 1) throw new Error("Sandbox helper emitted an invalid RPC response frame");

    const key = String(message.id);
    const pending = this.pending.get(key);
    if (!pending) return;

    if (isStreamStart) {
      if (pending.kind !== "binary" || pending.streamStarted) {
        throw new Error("Sandbox helper emitted an unexpected binary stream start");
      }
      const size = message.stream?.size;
      if (!Number.isSafeInteger(size) || (size as number) < 0) {
        throw new Error("Sandbox helper declared an invalid binary stream size");
      }
      if ((size as number) > RPC_STREAM_PAYLOAD_LIMIT) {
        throw new HelperRpcError(
          `Sandbox helper declared a binary stream larger than ${RPC_STREAM_PAYLOAD_LIMIT} bytes`,
          RPC_STREAM_TOO_LARGE,
        );
      }
      pending.streamStarted = true;
      pending.streamBuffer = Buffer.allocUnsafe(size as number);
      pending.streamOffset = 0;
      pending.streamMetadata = message.stream?.metadata;
      return;
    }

    if (isChunk) {
      if (pending.kind !== "binary" || !pending.streamStarted || !pending.streamBuffer) {
        throw new Error("Sandbox helper emitted a binary chunk before its stream start");
      }
      const chunk = decodeBinaryChunk(message.chunk);
      const offset = pending.streamOffset ?? 0;
      if (offset + chunk.length > pending.streamBuffer.length || offset + chunk.length > RPC_STREAM_PAYLOAD_LIMIT) {
        throw new Error("Sandbox helper binary stream exceeds its declared size");
      }
      chunk.copy(pending.streamBuffer, offset);
      pending.streamOffset = offset + chunk.length;
      return;
    }

    if (isError || isCancelled) {
      const error = message.error;
      if (isError && (!error || typeof error !== "object")) {
        throw new Error("Sandbox helper emitted an invalid RPC error");
      }
      this.removePending(key, pending);
      if (pending.cancellationRequested || isCancelled) {
        pending.reject(operationAbortedError());
      } else {
        pending.reject(new HelperRpcError(error?.message ?? "Sandbox helper request failed", error?.code));
      }
      return;
    }

    if (pending.kind === "binary") {
      if (!pending.streamStarted || !pending.streamBuffer) {
        throw new Error("Sandbox helper ended a binary response before its stream start");
      }
      if (pending.streamOffset !== pending.streamBuffer.length) {
        throw new Error(
          `Sandbox helper binary stream size mismatch (declared ${pending.streamBuffer.length}, received ${pending.streamOffset ?? 0})`,
        );
      }
      const value: HelperBinaryResult = {
        data: pending.streamBuffer,
        metadata: pending.streamMetadata,
        result: message.result,
      };
      this.removePending(key, pending);
      if (pending.cancellationRequested) pending.reject(operationAbortedError());
      else pending.resolve(value);
      return;
    }

    this.removePending(key, pending);
    if (pending.cancellationRequested) pending.reject(operationAbortedError());
    else pending.resolve(message.result);
  }

  request<T>(method: string, params: unknown, signal?: AbortSignal): Promise<T> {
    return this.startRequest<T>("simple", method, params, signal, async (id) => {
      await this.writer.write({ id, method, params });
    });
  }

  requestBinary<TMetadata = unknown, TResult = unknown>(
    method: string,
    params: unknown,
    signal?: AbortSignal,
  ): Promise<HelperBinaryResult<TMetadata, TResult>> {
    return this.startRequest<HelperBinaryResult<TMetadata, TResult>>("binary", method, params, signal, async (id) => {
      await this.writer.write({ id, method, params });
    });
  }

  requestWithBody<T>(
    method: string,
    params: unknown,
    bodyValue: Buffer | Uint8Array | string,
    signal?: AbortSignal,
  ): Promise<T> {
    const body = Buffer.isBuffer(bodyValue)
      ? bodyValue
      : typeof bodyValue === "string"
        ? Buffer.from(bodyValue, "utf8")
        : Buffer.from(bodyValue.buffer, bodyValue.byteOffset, bodyValue.byteLength);
    if (body.length > RPC_STREAM_PAYLOAD_LIMIT) {
      return Promise.reject(new HelperRpcError(
        `RPC request body is ${body.length} bytes; maximum is ${RPC_STREAM_PAYLOAD_LIMIT} bytes`,
        RPC_STREAM_TOO_LARGE,
      ));
    }
    return this.startRequest<T>("upload", method, params, signal, async (id, pending) => {
      await this.writer.write({ id, method, params, body: { size: body.length } });
      for (let offset = 0; offset < body.length; offset += RPC_BINARY_CHUNK_SIZE) {
        if (pending.cancellationRequested || this.closed) return;
        const chunk = body.subarray(offset, Math.min(body.length, offset + RPC_BINARY_CHUNK_SIZE));
        await this.writer.write({ id, bodyChunk: encodeBinaryChunk(chunk) });
      }
      if (pending.cancellationRequested || this.closed) return;
      await this.writer.write({ id, bodyEnd: true });
    });
  }

  // Alias with an explicit binary name for direct protocol users.
  requestWithBinaryBody<T>(
    method: string,
    params: unknown,
    body: Buffer | Uint8Array | string,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.requestWithBody<T>(method, params, body, signal);
  }

  private startRequest<T>(
    kind: PendingRequest["kind"],
    method: string,
    params: unknown,
    signal: AbortSignal | undefined,
    send: (id: string, pending: PendingRequest) => Promise<void>,
  ): Promise<T> {
    if (this.closed) return Promise.reject(new Error("Sandbox helper is not running"));
    if (signal?.aborted) return Promise.reject(operationAbortedError());
    if (this.pending.size >= RPC_CONCURRENCY_LIMIT) {
      return Promise.reject(new HelperRpcError(
        `Sandbox helper permits at most ${RPC_CONCURRENCY_LIMIT} concurrent RPC requests`,
        RPC_CONCURRENCY_LIMIT_CODE,
      ));
    }

    const id = String(this.nextId++);
    return new Promise<T>((resolve, reject) => {
      const pending: PendingRequest = {
        kind,
        resolve: resolve as (value: unknown) => void,
        reject,
        signal,
        cancellationRequested: false,
      };
      if (signal) {
        pending.onAbort = () => {
          if (this.pending.get(id) !== pending || pending.cancellationRequested) return;
          pending.cancellationRequested = true;
          void this.writer.write({ cancel: id }).catch((error: unknown) => {
            if (!this.closed) this.failProtocol(this.transportError(error));
          });
        };
        signal.addEventListener("abort", pending.onAbort, { once: true });
      }
      this.pending.set(id, pending);

      void send(id, pending).catch((error: unknown) => {
        if (this.pending.get(id) !== pending) return;
        if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === RPC_FRAME_TOO_LARGE) {
          this.removePending(id, pending);
          reject(new HelperRpcError(
            error instanceof Error ? error.message : "RPC frame is too large",
            RPC_FRAME_TOO_LARGE,
          ));
          return;
        }
        this.failProtocol(this.transportError(error));
      });
      if (signal?.aborted) pending.onAbort?.();
    });
  }

  private transportError(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`Sandbox helper RPC transport failed: ${message}`);
  }

  private removePending(id: string, pending: PendingRequest): void {
    if (this.pending.get(id) !== pending) return;
    this.pending.delete(id);
    if (pending.signal && pending.onAbort) pending.signal.removeEventListener("abort", pending.onAbort);
  }

  private failAll(error: Error): void {
    if (this.closed && this.pending.size === 0) return;
    this.closed = true;
    this.writer.close(error);
    for (const pending of this.pending.values()) {
      if (pending.signal && pending.onAbort) pending.signal.removeEventListener("abort", pending.onAbort);
      pending.reject(pending.cancellationRequested ? operationAbortedError() : error);
    }
    this.pending.clear();
  }

  private reportUnexpected(error: Error): void {
    if (this.unexpectedReported) return;
    this.unexpectedReported = true;
    this.onUnexpectedExit?.(error);
  }

  private failProtocol(error: Error): void {
    if (this.intentionalClose) return;
    void this.beginShutdown(error, true);
  }

  private childHasExited(): boolean {
    return this.child.exitCode != null || this.child.signalCode != null;
  }

  private beginShutdown(error: Error, unexpected: boolean): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;

    this.intentionalClose = true;
    this.failAll(error);

    const pid = this.child.pid;
    if (!pid || this.childHasExited()) {
      this.child.stdin.destroy();
      this.shutdownPromise = Promise.resolve();
    } else {
      this.shutdownPromise = new Promise<void>((resolve) => {
        let settled = false;
        let timer: NodeJS.Timeout | undefined;
        const done = () => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          this.child.removeListener("exit", done);
          this.child.removeListener("error", done);
          if (this.finishShutdownWait === done) this.finishShutdownWait = undefined;
          resolve();
        };
        this.finishShutdownWait = done;
        this.child.once("exit", done);
        this.child.once("error", done);
        timer = setTimeout(() => {
          if (!this.childHasExited()) killProcessGroup(pid, "SIGKILL");
          done();
        }, 1_000);
      });

      // Reject queued writes before closing the pipe. The helper receives both
      // EOF and SIGTERM, either of which runs its active-child cleanup.
      this.child.stdin.destroy();
      if (!this.childHasExited()) killProcessGroup(pid, "SIGTERM");
    }

    if (unexpected) this.reportUnexpected(error);
    return this.shutdownPromise;
  }

  close(error = new Error("Sandbox helper stopped")): Promise<void> {
    return this.beginShutdown(error, false);
  }

  get isClosed(): boolean {
    return this.closed;
  }

  get pendingCount(): number {
    return this.pending.size;
  }
}

export function killProcessGroup(pid: number, signal: NodeJS.Signals = "SIGKILL"): void {
  try {
    process.kill(-pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // Process already exited.
    }
  }
}
