import {
  RPC_BINARY_CHUNK_SIZE,
  RPC_CONCURRENCY_LIMIT,
  RPC_CONCURRENCY_LIMIT_CODE,
  RPC_FRAME_TOO_LARGE,
  RPC_STREAM_PAYLOAD_LIMIT,
  RPC_STREAM_TOO_LARGE,
  decodeBinaryChunk,
  encodeBinaryChunk,
  encodeRpcFrame,
} from "./rpc-framing.mjs";

function rpcError(error) {
  return {
    message: error instanceof Error ? error.message : String(error),
    code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
  };
}

function protocolError(message, code = "RPC_STREAM_INVALID") {
  return Object.assign(new Error(message), { code });
}

export function createHelperProtocol({ handlers, respond }) {
  const requests = new Map();
  const responseTerminated = new Set();

  async function send(message) {
    const id = message?.id === undefined ? undefined : String(message.id);
    if (id && responseTerminated.has(id)) return false;
    try {
      // Preflight with the same bounded serializer as the transport. This keeps
      // an oversized handler result request-scoped even with a generic responder.
      encodeRpcFrame(message);
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== RPC_FRAME_TOO_LARGE || !id) throw error;
      responseTerminated.add(id);
      await respond({
        id,
        error: {
          message: "Sandbox helper RPC result exceeds the maximum frame size",
          code: RPC_FRAME_TOO_LARGE,
        },
      });
      return false;
    }
    await respond(message);
    return true;
  }

  function removeRequest(id, request) {
    if (requests.get(id) === request) requests.delete(id);
    responseTerminated.delete(id);
  }

  async function runHandler(id, request) {
    const handler = handlers[request.method];
    if (!handler) {
      await send({ id, error: { message: `Unknown helper method: ${String(request.method)}`, code: "UNKNOWN_METHOD" } });
      removeRequest(id, request);
      return;
    }

    request.phase = "active";
    let streamStarted = false;
    let streamDeclared = 0;
    let streamSent = 0;
    const stream = {
      async start(size, metadata) {
        if (streamStarted) throw protocolError("Binary response stream was started more than once");
        if (!Number.isSafeInteger(size) || size < 0) throw protocolError("Binary response stream size is invalid");
        if (size > RPC_STREAM_PAYLOAD_LIMIT) {
          throw protocolError(
            `Binary response stream is ${size} bytes; maximum is ${RPC_STREAM_PAYLOAD_LIMIT} bytes`,
            RPC_STREAM_TOO_LARGE,
          );
        }
        streamStarted = true;
        streamDeclared = size;
        if (!await send({ id, stream: { size, metadata } })) {
          throw protocolError("Binary stream start frame is too large", RPC_FRAME_TOO_LARGE);
        }
      },
      async chunk(value) {
        if (!streamStarted) throw protocolError("Binary response chunk was emitted before stream start");
        const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
        if (bytes.length > RPC_BINARY_CHUNK_SIZE) {
          throw protocolError(`Binary response chunk exceeds ${RPC_BINARY_CHUNK_SIZE} bytes`);
        }
        if (streamSent + bytes.length > streamDeclared || streamSent + bytes.length > RPC_STREAM_PAYLOAD_LIMIT) {
          throw protocolError("Binary response stream exceeds its declared size");
        }
        request.controller.signal.throwIfAborted();
        streamSent += bytes.length;
        if (!await send({ id, chunk: encodeBinaryChunk(bytes) })) {
          throw protocolError("Binary stream chunk frame is too large", RPC_FRAME_TOO_LARGE);
        }
      },
    };

    let result;
    let error;
    let failed = false;
    try {
      result = await handler(request.params, request.controller.signal, stream, request.body);
      if (streamStarted && streamSent !== streamDeclared) {
        throw protocolError(
          `Binary response stream size mismatch (declared ${streamDeclared}, emitted ${streamSent})`,
        );
      }
    } catch (caught) {
      failed = true;
      error = caught;
    }

    try {
      if (request.controller.signal.aborted) await send({ id, cancelled: true });
      else if (failed) await send({ id, error: rpcError(error) });
      else await send({ id, result: result === undefined ? null : result });
    } finally {
      removeRequest(id, request);
    }
  }

  async function failUpload(id, request, error) {
    request.controller.abort();
    try {
      await send({ id, error: rpcError(error) });
    } finally {
      removeRequest(id, request);
    }
  }

  async function dispatch(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) return;

    if ("cancel" in message) {
      const id = String(message.cancel);
      const request = requests.get(id);
      if (!request) return;
      request.controller.abort();
      if (request.phase === "upload") {
        try {
          await send({ id, cancelled: true });
        } finally {
          removeRequest(id, request);
        }
      }
      return;
    }

    const id = message.id === undefined ? undefined : String(message.id);
    if (!id) return;

    if ("bodyChunk" in message || message.bodyEnd === true) {
      const request = requests.get(id);
      if (!request || request.phase !== "upload") {
        await send({ id, error: rpcError(protocolError("Request body frame has no matching upload")) });
        return;
      }
      if ("bodyChunk" in message) {
        let chunk;
        try {
          chunk = decodeBinaryChunk(message.bodyChunk);
          if (request.bodyOffset + chunk.length > request.body.length) {
            throw protocolError("Request body exceeds its declared size");
          }
          chunk.copy(request.body, request.bodyOffset);
          request.bodyOffset += chunk.length;
        } catch (error) {
          await failUpload(id, request, error);
        }
        return;
      }
      if (request.bodyOffset !== request.body.length) {
        await failUpload(
          id,
          request,
          protocolError(`Request body size mismatch (declared ${request.body.length}, received ${request.bodyOffset})`),
        );
        return;
      }
      await runHandler(id, request);
      return;
    }

    if (requests.has(id)) {
      await send({ id, error: { message: "Duplicate helper request id", code: "DUPLICATE_REQUEST" } });
      return;
    }
    if (requests.size >= RPC_CONCURRENCY_LIMIT) {
      await send({
        id,
        error: {
          message: `Sandbox helper permits at most ${RPC_CONCURRENCY_LIMIT} concurrent RPC requests`,
          code: RPC_CONCURRENCY_LIMIT_CODE,
        },
      });
      return;
    }

    const request = {
      method: message.method,
      params: message.params,
      controller: new AbortController(),
      phase: "active",
      body: undefined,
      bodyOffset: 0,
    };
    requests.set(id, request);

    if (message.body !== undefined) {
      const size = message.body?.size;
      if (!Number.isSafeInteger(size) || size < 0) {
        await failUpload(id, request, protocolError("Request body declared an invalid size"));
        return;
      }
      if (size > RPC_STREAM_PAYLOAD_LIMIT) {
        await failUpload(
          id,
          request,
          protocolError(
            `Request body is ${size} bytes; maximum is ${RPC_STREAM_PAYLOAD_LIMIT} bytes`,
            RPC_STREAM_TOO_LARGE,
          ),
        );
        return;
      }
      request.phase = "upload";
      request.body = Buffer.allocUnsafe(size);
      if (size === 0) request.body = Buffer.alloc(0);
      return;
    }

    await runHandler(id, request);
  }

  function abortAll() {
    for (const request of requests.values()) request.controller.abort();
  }

  return {
    dispatch,
    abortAll,
    get pendingCount() {
      return requests.size;
    },
  };
}
