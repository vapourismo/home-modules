export interface HelperProtocolError {
  message: string;
  code?: string;
}

export type HelperResponderMessage =
  | { id: string; result: unknown }
  | { id: string; error: HelperProtocolError }
  | { id: string; cancelled: true }
  | { id: string; stream: { size: number; metadata: unknown } }
  | { id: string; chunk: string };

export interface HelperResponseStream {
  start(size: number, metadata: unknown): Promise<void>;
  chunk(value: Buffer | Uint8Array | string): Promise<void>;
}

export type HelperHandler = (
  params: unknown,
  signal: AbortSignal,
  stream: HelperResponseStream,
  body: Buffer | undefined,
) => unknown | Promise<unknown>;

export interface CreateHelperProtocolOptions {
  handlers: Readonly<Record<string, HelperHandler | undefined>>;
  respond: (message: HelperResponderMessage) => void | Promise<void>;
}

export interface HelperProtocol {
  dispatch(message: unknown): Promise<void>;
  abortAll(): void;
  readonly pendingCount: number;
}

export function createHelperProtocol(
  options: CreateHelperProtocolOptions,
): HelperProtocol;
