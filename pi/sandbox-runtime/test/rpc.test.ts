import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import {
  HelperRpcClient,
  HelperRpcError,
  RPC_BINARY_CHUNK_SIZE,
  RPC_CONCURRENCY_LIMIT,
  RPC_CONCURRENCY_LIMIT_CODE,
  RPC_FRAME_PAYLOAD_LIMIT,
  RPC_FRAME_TOO_LARGE,
  RPC_STREAM_PAYLOAD_LIMIT,
} from "../src/rpc.ts";
import { BoundedNewlineDecoder, RpcFrameWriter } from "../src/rpc-framing.mjs";

class FakeChild extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  pid: number | undefined;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  private inputBuffer = "";
  private readonly frames: any[] = [];

  constructor(pid?: number) {
    super();
    this.pid = pid;
    this.stdin.setEncoding("utf8");
    this.stdin.on("data", (chunk: string) => {
      this.inputBuffer += chunk;
      for (;;) {
        const newline = this.inputBuffer.indexOf("\n");
        if (newline === -1) break;
        const line = this.inputBuffer.slice(0, newline).trim();
        this.inputBuffer = this.inputBuffer.slice(newline + 1);
        if (!line) continue;
        this.frames.push(JSON.parse(line));
        this.emit("frame");
      }
    });
  }

  async nextFrame(): Promise<any> {
    if (this.frames.length === 0) await once(this, "frame");
    return this.frames.shift();
  }

  get queuedFrameCount(): number {
    return this.frames.length;
  }
}

async function nextRequest(child: FakeChild): Promise<any> {
  return child.nextFrame();
}

async function flushAsyncWork(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test("RPC framing handles partial chunks and concurrent response IDs", async () => {
  const child = new FakeChild();
  const client = new HelperRpcClient(child as any);
  const first = client.request<{ value: number }>("first", {});
  const firstRequest = await nextRequest(child);
  const second = client.request<{ value: number }>("second", {});
  const secondRequest = await nextRequest(child);

  const response = `${JSON.stringify({ id: secondRequest.id, result: { value: 2 } })}\n${JSON.stringify({ id: firstRequest.id, result: { value: 1 } })}\n`;
  child.stdout.write(response.slice(0, 7));
  child.stdout.write(response.slice(7));
  assert.deepEqual(await Promise.all([first, second]), [{ value: 1 }, { value: 2 }]);
  assert.equal(client.pendingCount, 0);
});

test("RPC cancellation stays pending until one terminal acknowledgement", async () => {
  const child = new FakeChild();
  const client = new HelperRpcClient(child as any);
  const controller = new AbortController();
  let settled = false;
  const promise = client.request("slow", {}, controller.signal);
  const outcome = promise.then(
    (value) => { settled = true; return value; },
    (error) => { settled = true; return error; },
  );
  const request = await nextRequest(child);

  controller.abort();
  controller.abort();
  const cancellation = await nextRequest(child);
  assert.deepEqual(cancellation, { cancel: request.id });
  await flushAsyncWork();
  assert.equal(child.queuedFrameCount, 0);
  assert.equal(client.pendingCount, 1);
  assert.equal(settled, false);

  child.stdout.write(`${JSON.stringify({ id: request.id, cancelled: true })}\n`);
  const error = await outcome;
  assert.ok(error instanceof Error);
  assert.match(error.message, /Operation aborted/);
  assert.equal(client.pendingCount, 0);
});

test("pre-aborted RPC requests reject without starting helper work", async () => {
  const child = new FakeChild();
  const client = new HelperRpcClient(child as any);
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(client.request("slow", {}, controller.signal), /Operation aborted/);
  await flushAsyncWork();
  assert.equal(child.queuedFrameCount, 0);
  assert.equal(client.pendingCount, 0);
});

test("result and error responses after cancellation only confirm aborted settlement", async (t) => {
  const cases = [
    { name: "result", response: { result: { value: 1 } } },
    { name: "error", response: { error: { message: "late helper failure", code: "LATE" } } },
  ];

  for (const testCase of cases) {
    await t.test(testCase.name, async () => {
      const child = new FakeChild();
      const client = new HelperRpcClient(child as any);
      const controller = new AbortController();
      const promise = client.request("slow", {}, controller.signal);
      const request = await nextRequest(child);
      controller.abort();
      await nextRequest(child);

      child.stdout.write(`${JSON.stringify({ id: request.id, ...testCase.response })}\n`);
      await assert.rejects(promise, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "Operation aborted");
        return true;
      });
      assert.equal(client.pendingCount, 0);
    });
  }
});

test("helper exit safely settles cancellation-requested operations", async () => {
  const child = new FakeChild();
  let unexpected: Error | undefined;
  const client = new HelperRpcClient(child as any, (error) => { unexpected = error; });
  const controller = new AbortController();
  const pending = client.request("slow", {}, controller.signal);
  await nextRequest(child);
  controller.abort();
  await nextRequest(child);

  child.emit("exit", 9, null);
  await assert.rejects(pending, /Operation aborted/);
  assert.match(unexpected?.message ?? "", /code 9/);
  assert.equal(client.isClosed, true);
});

test("helper exit rejects all pending requests and reports unexpected exit", async () => {
  const child = new FakeChild();
  let unexpected: Error | undefined;
  const client = new HelperRpcClient(child as any, (error) => { unexpected = error; });
  const first = client.request("one", {});
  const second = client.request("two", {});
  child.emit("exit", 9, null);
  await assert.rejects(first, /code 9/);
  await assert.rejects(second, /code 9/);
  assert.match(unexpected?.message ?? "", /code 9/);
  assert.equal(client.isClosed, true);
});

test("malformed helper output closes the helper and reports a protocol failure", async () => {
  const child = new FakeChild();
  let unexpected: Error | undefined;
  const client = new HelperRpcClient(child as any, (error) => { unexpected = error; });
  const pending = client.request("one", {});
  child.stdout.write("not json\n");
  await assert.rejects(pending, /malformed RPC JSON/);
  assert.equal(client.isClosed, true);
  assert.equal(child.stdin.destroyed, true);
  assert.match(unexpected?.message ?? "", /malformed RPC JSON/);
});

test("close settles requests immediately and reuses a SIGTERM-first shutdown", async (t) => {
  const originalKill = process.kill;
  const signals: Array<{ pid: number; signal: NodeJS.Signals | number | undefined }> = [];
  process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
    signals.push({ pid, signal });
    return true;
  }) as typeof process.kill;
  t.after(() => { process.kill = originalKill; });

  const child = new FakeChild(424_242);
  let unexpectedCount = 0;
  const client = new HelperRpcClient(child as any, () => { unexpectedCount++; });
  let pendingError: Error | undefined;
  const pending = client.request("hold", {}).catch((error: Error) => {
    pendingError = error;
    throw error;
  });
  await nextRequest(child);

  const reason = new Error("planned helper stop");
  const shutdown = client.close(reason);
  const repeated = client.close(new Error("ignored repeated reason"));
  assert.strictEqual(repeated, shutdown);
  assert.equal(client.isClosed, true);
  assert.equal(client.pendingCount, 0);
  assert.deepEqual(signals, [{ pid: -424_242, signal: "SIGTERM" }]);

  await assert.rejects(pending, (error: unknown) => error === reason);
  assert.strictEqual(pendingError, reason);
  assert.equal(unexpectedCount, 0);

  child.exitCode = 0;
  child.emit("exit", 0, null);
  await shutdown;
  await new Promise<void>((resolve) => setTimeout(resolve, 1_100));
  assert.deepEqual(signals, [{ pid: -424_242, signal: "SIGTERM" }]);
  assert.equal(unexpectedCount, 0);
});

test("close escalates an unresponsive helper to SIGKILL after one second", async (t) => {
  const originalKill = process.kill;
  const signals: Array<{ pid: number; signal: NodeJS.Signals | number | undefined }> = [];
  process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
    signals.push({ pid, signal });
    return true;
  }) as typeof process.kill;
  t.after(() => { process.kill = originalKill; });

  const child = new FakeChild(434_343);
  const client = new HelperRpcClient(child as any);
  const shutdown = client.close();
  assert.deepEqual(signals, [{ pid: -434_343, signal: "SIGTERM" }]);
  await shutdown;
  assert.deepEqual(signals, [
    { pid: -434_343, signal: "SIGTERM" },
    { pid: -434_343, signal: "SIGKILL" },
  ]);
  assert.strictEqual(client.close(), shutdown);
});

test("byte framing handles boundaries across partial and multiple chunks", () => {
  const frames: string[] = [];
  const decoder = new BoundedNewlineDecoder((frame: Buffer) => frames.push(frame.toString("utf8")), { maxBytes: 8 });
  decoder.push(Buffer.from("one\ntw"));
  assert.equal(decoder.bufferedBytes, 2);
  decoder.push(Buffer.from("o\nthree\n"));
  assert.deepEqual(frames, ["one", "two", "three"]);
  assert.throws(() => decoder.push(Buffer.from("123456789")), (error: any) => error.code === RPC_FRAME_TOO_LARGE);
  assert.equal(decoder.bufferedBytes, 0);
});

test("oversized outgoing request is scoped and leaves the client usable", async () => {
  const child = new FakeChild();
  const client = new HelperRpcClient(child as any);
  await assert.rejects(
    client.request("large", { value: "x".repeat(RPC_FRAME_PAYLOAD_LIMIT) }),
    (error: unknown) => error instanceof HelperRpcError && error.code === RPC_FRAME_TOO_LARGE,
  );
  assert.equal(client.isClosed, false);
  assert.equal(client.pendingCount, 0);

  const next = client.request("probe", {});
  const frame = await nextRequest(child);
  child.stdout.write(`${JSON.stringify({ id: frame.id, result: { ok: true } })}\n`);
  assert.deepEqual(await next, { ok: true });
});

test("oversized incoming frame closes only this helper client", async () => {
  const child = new FakeChild();
  let unexpected: Error | undefined;
  const client = new HelperRpcClient(child as any, (error) => { unexpected = error; });
  const pending = client.request("one", {});
  await nextRequest(child);
  child.stdout.write(Buffer.alloc(RPC_FRAME_PAYLOAD_LIMIT + 1, 0x78));
  await assert.rejects(pending, (error: any) => error.code === RPC_FRAME_TOO_LARGE);
  assert.equal(client.isClosed, true);
  assert.match(unexpected?.message ?? "", /larger/);
});

test("RPC client enforces sixteen pending slots including cancellations", async () => {
  const child = new FakeChild();
  const client = new HelperRpcClient(child as any);
  const requests = Array.from({ length: RPC_CONCURRENCY_LIMIT }, (_, index) => client.request("hold", { index }));
  const frames = [];
  for (let index = 0; index < RPC_CONCURRENCY_LIMIT; index++) frames.push(await nextRequest(child));
  await assert.rejects(
    client.request("excess", {}),
    (error: unknown) => error instanceof HelperRpcError && error.code === RPC_CONCURRENCY_LIMIT_CODE,
  );
  for (const frame of frames) child.stdout.write(`${JSON.stringify({ id: frame.id, result: null })}\n`);
  await Promise.all(requests);
});

test("binary response streams allocate once and validate terminal size", async () => {
  const child = new FakeChild();
  const client = new HelperRpcClient(child as any);
  const promise = client.requestBinary<{ mimeType: string }>("read", {});
  const frame = await nextRequest(child);
  const first = Buffer.alloc(RPC_BINARY_CHUNK_SIZE, 0x61);
  const second = Buffer.from("tail");
  child.stdout.write(`${JSON.stringify({ id: frame.id, stream: { size: first.length + second.length, metadata: { mimeType: "x/test" } } })}\n`);
  child.stdout.write(`${JSON.stringify({ id: frame.id, chunk: first.toString("base64") })}\n`);
  child.stdout.write(`${JSON.stringify({ id: frame.id, chunk: second.toString("base64") })}\n`);
  child.stdout.write(`${JSON.stringify({ id: frame.id, result: { done: true } })}\n`);
  const result = await promise;
  assert.equal(result.data.length, first.length + second.length);
  assert.equal(result.data.subarray(-4).toString(), "tail");
  assert.deepEqual(result.metadata, { mimeType: "x/test" });
});

test("malformed binary stream ordering and encoding fail the helper client", async (t) => {
  const cases = [
    { name: "missing start", frames: (id: string) => [{ id, result: null }] },
    { name: "invalid base64", frames: (id: string) => [{ id, stream: { size: 1 } }, { id, chunk: "%%%=" }] },
    { name: "size mismatch", frames: (id: string) => [{ id, stream: { size: 2 } }, { id, chunk: "YQ==" }, { id, result: null }] },
    { name: "cumulative overflow", frames: (id: string) => [{ id, stream: { size: 1 } }, { id, chunk: "YWI=" }] },
  ];
  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const child = new FakeChild();
      const client = new HelperRpcClient(child as any);
      const pending = client.requestBinary("read", {});
      const request = await nextRequest(child);
      for (const frame of entry.frames(request.id)) child.stdout.write(`${JSON.stringify(frame)}\n`);
      await assert.rejects(pending);
      assert.equal(client.isClosed, true);
    });
  }
});

test("streamed request bodies use bounded ordered chunks", async () => {
  const child = new FakeChild();
  const client = new HelperRpcClient(child as any);
  const body = Buffer.alloc(RPC_BINARY_CHUNK_SIZE * 2 + 7, 0x62);
  const promise = client.requestWithBody("write", { path: "/tmp/value" }, body);
  const start = await nextRequest(child);
  assert.deepEqual(start.body, { size: body.length });
  const chunks: Buffer[] = [];
  for (;;) {
    const frame = await nextRequest(child);
    if (frame.bodyEnd) break;
    chunks.push(Buffer.from(frame.bodyChunk, "base64"));
  }
  assert.deepEqual(Buffer.concat(chunks), body);
  child.stdout.write(`${JSON.stringify({ id: start.id, result: { bytes: body.length } })}\n`);
  assert.deepEqual(await promise, { bytes: body.length });

  await assert.rejects(
    client.requestWithBody("write", {}, Buffer.alloc(RPC_STREAM_PAYLOAD_LIMIT + 1)),
    (error: unknown) => error instanceof HelperRpcError && error.code === "RPC_STREAM_TOO_LARGE",
  );
});

test("frame writer preserves order while awaiting backpressure", async () => {
  const frames: string[] = [];
  const writable = new Writable({
    highWaterMark: 1,
    write(chunk, _encoding, callback) {
      setTimeout(() => {
        frames.push(chunk.toString("utf8").trim());
        callback();
      }, 2);
    },
  });
  const writer = new RpcFrameWriter(writable);
  await Promise.all([writer.write({ order: 1 }), writer.write({ order: 2 }), writer.write({ order: 3 })]);
  assert.deepEqual(frames.map((frame) => JSON.parse(frame).order), [1, 2, 3]);
});

test("EPIPE settles pending work without an unhandled rejection", async () => {
  const child = new FakeChild();
  const client = new HelperRpcClient(child as any);
  const pending = client.request("one", {});
  await nextRequest(child);
  const error = Object.assign(new Error("broken pipe"), { code: "EPIPE" });
  child.stdin.destroy(error);
  await assert.rejects(pending, /stdin error|transport failed|broken pipe/);
  assert.equal(client.isClosed, true);
});
