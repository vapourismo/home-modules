import type { Writable } from "node:stream";

export const RPC_FRAME_PAYLOAD_LIMIT: number;
export const RPC_BINARY_CHUNK_SIZE: number;
export const RPC_STREAM_PAYLOAD_LIMIT: number;
export const RPC_CONCURRENCY_LIMIT: number;
export const RPC_READ_CONCURRENCY_LIMIT: number;
export const TEXT_READ_MAX_LINES: number;
export const TEXT_READ_MAX_BYTES: number;

export const MAX_RPC_FRAME_BYTES: number;
export const MAX_BINARY_CHUNK_BYTES: number;
export const MAX_FILE_PAYLOAD_BYTES: number;
export const MAX_RPC_CONCURRENCY: number;
export const MAX_READ_CONCURRENCY: number;

export const RPC_FRAME_TOO_LARGE: "RPC_FRAME_TOO_LARGE";
export const RPC_STREAM_TOO_LARGE: "RPC_STREAM_TOO_LARGE";
export const RPC_CONCURRENCY_LIMIT_CODE: "RPC_CONCURRENCY_LIMIT";
export const FILE_TOO_LARGE: "FILE_TOO_LARGE";

export class RpcLimitError extends Error {
  readonly code: string;
  constructor(message: string, code: string);
}

export interface BoundedJsonResult {
  json: string;
  bytes: number;
}

export function boundedJsonStringify(
  root: unknown,
  maxBytes?: number,
): BoundedJsonResult | undefined;

export function encodeRpcFrame(message: unknown, maxBytes?: number): Buffer;

export interface BoundedNewlineDecoderOptions {
  maxBytes?: number;
}

export class BoundedNewlineDecoder {
  constructor(
    onFrame: (frame: Buffer) => void,
    options?: BoundedNewlineDecoderOptions,
  );
  push(value: Buffer | Uint8Array | string): void;
  end(): void;
  get bufferedBytes(): number;
}

export interface RpcFrameWriterOptions {
  maxBytes?: number;
}

export class RpcFrameWriter {
  constructor(writable: Writable, options?: RpcFrameWriterOptions);
  write(message: unknown): Promise<void>;
  fail(error?: Error): void;
  close(error?: Error): void;
}

export function encodeBinaryChunk(bytes: Buffer | Uint8Array): string;
export function decodeBinaryChunk(value: unknown): Buffer;
export function waitForDrain(writable: Writable): Promise<void>;
