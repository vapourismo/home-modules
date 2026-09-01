import assert from "node:assert/strict";
import test from "node:test";
import { createHelperProtocol } from "../src/helper-protocol.mjs";
import {
  RPC_BINARY_CHUNK_SIZE,
  RPC_CONCURRENCY_LIMIT,
  RPC_FRAME_PAYLOAD_LIMIT,
  RPC_STREAM_PAYLOAD_LIMIT,
} from "../src/rpc-framing.mjs";

test("helper cancellation acknowledges only after the handler settles", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let handlerSignal: AbortSignal | undefined;
  const responses: unknown[] = [];
  const protocol = createHelperProtocol({
    handlers: {
      slow: async (_params: unknown, signal: AbortSignal) => {
        handlerSignal = signal;
        await gate;
        return { completed: true };
      },
    },
    respond: (message: unknown) => responses.push(message),
  });

  const inFlight = protocol.dispatch({ id: "request-1", method: "slow", params: {} });
  assert.equal(protocol.pendingCount, 1);
  await protocol.dispatch({ cancel: "request-1" });
  assert.equal(handlerSignal?.aborted, true);
  assert.deepEqual(responses, []);
  assert.equal(protocol.pendingCount, 1);

  release();
  await inFlight;
  assert.deepEqual(responses, [{ id: "request-1", cancelled: true }]);
  assert.equal(protocol.pendingCount, 0);

  await protocol.dispatch({ cancel: "request-1" });
  assert.deepEqual(responses, [{ id: "request-1", cancelled: true }]);
});

test("helper protocol preserves normal results and serialized errors", async () => {
  const responses: unknown[] = [];
  const protocol = createHelperProtocol({
    handlers: {
      succeed: async () => ({ value: 42 }),
      fail: async () => { throw Object.assign(new Error("failed"), { code: "EFAIL" }); },
    },
    respond: (message: unknown) => responses.push(message),
  });

  await protocol.dispatch({ id: "success", method: "succeed", params: {} });
  await protocol.dispatch({ id: "failure", method: "fail", params: {} });
  assert.deepEqual(responses, [
    { id: "success", result: { value: 42 } },
    { id: "failure", error: { message: "failed", code: "EFAIL" } },
  ]);
});

test("helper protocol awaits ordered streamed output", async () => {
  const responses: any[] = [];
  let responders = 0;
  const protocol = createHelperProtocol({
    handlers: {
      read: async (_params: unknown, _signal: AbortSignal, stream: any) => {
        await stream.start(3, { kind: "test" });
        await stream.chunk(Buffer.from("ab"));
        await stream.chunk(Buffer.from("c"));
        return { complete: true };
      },
    },
    respond: async (message: unknown) => {
      responders++;
      assert.equal(responders, 1, "responses were written concurrently");
      await new Promise((resolve) => setTimeout(resolve, 1));
      responses.push(message);
      responders--;
    },
  });

  await protocol.dispatch({ id: "stream", method: "read", params: {} });
  assert.deepEqual(responses, [
    { id: "stream", stream: { size: 3, metadata: { kind: "test" } } },
    { id: "stream", chunk: Buffer.from("ab").toString("base64") },
    { id: "stream", chunk: Buffer.from("c").toString("base64") },
    { id: "stream", result: { complete: true } },
  ]);
});

test("helper protocol assembles a streamed request before mutation", async () => {
  const responses: unknown[] = [];
  let observed: Buffer | undefined;
  const protocol = createHelperProtocol({
    handlers: {
      write: async (_params: unknown, _signal: AbortSignal, _stream: unknown, body: Buffer) => {
        observed = Buffer.from(body);
        return { bytes: body.length };
      },
    },
    respond: (message: unknown) => responses.push(message),
  });
  const body = Buffer.alloc(RPC_BINARY_CHUNK_SIZE + 3, 0x61);
  await protocol.dispatch({ id: "upload", method: "write", params: {}, body: { size: body.length } });
  assert.equal(observed, undefined);
  await protocol.dispatch({ id: "upload", bodyChunk: body.subarray(0, RPC_BINARY_CHUNK_SIZE).toString("base64") });
  assert.equal(observed, undefined);
  await protocol.dispatch({ id: "upload", bodyChunk: body.subarray(RPC_BINARY_CHUNK_SIZE).toString("base64") });
  assert.equal(observed, undefined);
  await protocol.dispatch({ id: "upload", bodyEnd: true });
  assert.deepEqual(observed, body);
  assert.deepEqual(responses, [{ id: "upload", result: { bytes: body.length } }]);
});

test("cancelled and malformed incomplete uploads never invoke the handler", async () => {
  let calls = 0;
  const responses: any[] = [];
  const protocol = createHelperProtocol({
    handlers: { write: async () => { calls++; } },
    respond: (message: unknown) => responses.push(message),
  });

  await protocol.dispatch({ id: "cancel", method: "write", body: { size: 4 } });
  await protocol.dispatch({ id: "cancel", bodyChunk: "YQ==" });
  await protocol.dispatch({ cancel: "cancel" });
  assert.equal(calls, 0);
  assert.deepEqual(responses, [{ id: "cancel", cancelled: true }]);

  await protocol.dispatch({ id: "short", method: "write", body: { size: 4 } });
  await protocol.dispatch({ id: "short", bodyChunk: "YQ==" });
  await protocol.dispatch({ id: "short", bodyEnd: true });
  assert.equal(calls, 0);
  assert.equal(responses.at(-1).error.code, "RPC_STREAM_INVALID");

  await protocol.dispatch({ id: "large", method: "write", body: { size: RPC_STREAM_PAYLOAD_LIMIT + 1 } });
  assert.equal(responses.at(-1).error.code, "RPC_STREAM_TOO_LARGE");
});

test("oversized helper results become compact request-scoped errors", async () => {
  const responses: any[] = [];
  const protocol = createHelperProtocol({
    handlers: {
      large: async () => ({ value: "x".repeat(RPC_FRAME_PAYLOAD_LIMIT) }),
      small: async () => ({ ok: true }),
    },
    respond: (message: unknown) => responses.push(message),
  });
  await protocol.dispatch({ id: "large", method: "large" });
  await protocol.dispatch({ id: "small", method: "small" });
  assert.equal(responses[0].error.code, "RPC_FRAME_TOO_LARGE");
  assert.deepEqual(responses[1], { id: "small", result: { ok: true } });
});

test("helper protocol enforces its concurrent request cap", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const responses: any[] = [];
  const protocol = createHelperProtocol({
    handlers: { hold: async () => { await gate; return null; } },
    respond: (message: unknown) => responses.push(message),
  });
  const pending = Array.from({ length: RPC_CONCURRENCY_LIMIT }, (_, index) =>
    protocol.dispatch({ id: String(index), method: "hold" }));
  assert.equal(protocol.pendingCount, RPC_CONCURRENCY_LIMIT);
  await protocol.dispatch({ id: "excess", method: "hold" });
  assert.equal(responses[0].id, "excess");
  assert.equal(responses[0].error.code, "RPC_CONCURRENCY_LIMIT");
  release();
  await Promise.all(pending);
  assert.equal(protocol.pendingCount, 0);
});
