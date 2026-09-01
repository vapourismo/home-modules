import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { createSandboxToolDefinitions } from "../src/tools.ts";

interface Deferred<T = void> {
  promise: Promise<T>;
  resolve: (value?: T | PromiseLike<T>) => void;
  reject: (error: unknown) => void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value?: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise as (value?: T | PromiseLike<T>) => void;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function waitFor(predicate: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await flush();
  }
  assert.fail(message);
}

function context(cwd: string): any {
  return { cwd };
}

function fullRead(content: string, filePath: string): any {
  return {
    data: Buffer.from(content),
    metadata: { kind: "full", path: filePath, mimeType: null },
    result: {},
  };
}

test("real-path and symlink edits serialize the complete read-modify-write window", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-mutation-alias-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const realPath = path.join(root, "real.txt");
  const aliasPath = path.join(root, "alias.txt");
  await writeFile(realPath, "alpha beta\n");
  await symlink(realPath, aliasPath);

  let content = "alpha beta\n";
  let reads = 0;
  const events: string[] = [];
  const firstReadStarted = deferred();
  const releaseFirstRead = deferred();
  const rpc = {
    async request(method: string) {
      assert.equal(method, "mutationKey");
      return { available: true, key: realPath };
    },
    async requestBinary(_method: string, params: any) {
      const snapshot = content;
      reads++;
      events.push(`read:${path.basename(params.paths[0])}`);
      if (reads === 1) {
        firstReadStarted.resolve();
        await releaseFirstRead.promise;
      }
      return fullRead(snapshot, params.paths[0]);
    },
    async requestWithBody(_method: string, params: any, body: Buffer) {
      events.push(`write:${path.basename(params.path)}`);
      content = body.toString("utf8");
      return { bytes: body.length };
    },
  };
  const tools = createSandboxToolDefinitions(root, async () => rpc as any);

  const first = tools.edit.execute(
    "real-edit",
    { path: realPath, edits: [{ oldText: "alpha", newText: "ALPHA" }] },
    undefined,
    undefined,
    context(root),
  );
  await firstReadStarted.promise;
  const second = tools.edit.execute(
    "alias-edit",
    { path: aliasPath, edits: [{ oldText: "beta", newText: "BETA" }] },
    undefined,
    undefined,
    context(root),
  );
  await flush();
  assert.equal(reads, 1, "the alias edit read while the real-path edit still held the queue");

  releaseFirstRead.resolve();
  await Promise.all([first, second]);
  assert.equal(content, "ALPHA BETA\n");
  assert.deepEqual(events, ["read:real.txt", "write:real.txt", "read:alias.txt", "write:alias.txt"]);
});

test("Pi shared queue holders block sandbox edit and write", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-mutation-shared-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "shared.txt");
  await writeFile(target, "before\n");

  const holderStarted = deferred();
  const releaseHolder = deferred();
  const holder = withFileMutationQueue(target, async () => {
    holderStarted.resolve();
    await releaseHolder.promise;
  });
  await holderStarted.promise;

  let mutationCalls = 0;
  let canonicalizations = 0;
  const rpc = {
    async request(method: string) {
      assert.equal(method, "mutationKey");
      canonicalizations++;
      return { available: true, key: target };
    },
    async requestBinary() {
      mutationCalls++;
      return fullRead("before\n", target);
    },
    async requestWithBody(_method: string, _params: any, body: Buffer) {
      mutationCalls++;
      return { bytes: body.length };
    },
  };
  const tools = createSandboxToolDefinitions(root, async () => rpc as any);
  const edit = tools.edit.execute(
    "blocked-edit",
    { path: target, edits: [{ oldText: "before", newText: "after" }] },
    undefined,
    undefined,
    context(root),
  );
  const write = tools.write.execute(
    "blocked-write",
    { path: target, content: "before\n" },
    undefined,
    undefined,
    context(root),
  );
  await waitFor(() => canonicalizations === 2, "sandbox mutations did not canonicalize");
  await flush();
  assert.equal(mutationCalls, 0, "sandbox mutation bypassed Pi's shared queue holder");

  releaseHolder.resolve();
  await Promise.all([holder, edit, write]);
  assert.equal(mutationCalls, 3);
});

test("different canonical files mutate concurrently", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-mutation-parallel-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const firstPath = path.join(root, "first.txt");
  const secondPath = path.join(root, "second.txt");
  await Promise.all([writeFile(firstPath, "first"), writeFile(secondPath, "second")]);

  let active = 0;
  let maxActive = 0;
  const releases = new Map<string, Deferred>();
  const started = new Set<string>();
  const rpc = {
    async request(method: string, params: any) {
      assert.equal(method, "mutationKey");
      return { available: true, key: params.path };
    },
    async requestWithBody(_method: string, params: any, body: Buffer) {
      active++;
      maxActive = Math.max(maxActive, active);
      started.add(params.path);
      const release = deferred();
      releases.set(params.path, release);
      await release.promise;
      active--;
      return { bytes: body.length };
    },
  };
  const tools = createSandboxToolDefinitions(root, async () => rpc as any);
  const first = tools.write.execute("first", { path: firstPath, content: "one" }, undefined, undefined, context(root));
  const second = tools.write.execute("second", { path: secondPath, content: "two" }, undefined, undefined, context(root));
  await waitFor(() => started.size === 2, "independent writes did not start concurrently");
  assert.equal(maxActive, 2);
  releases.get(firstPath)!.resolve();
  releases.get(secondPath)!.resolve();
  await Promise.all([first, second]);
});

test("unavailable canonicalization uses a fair exclusive fallback", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-mutation-fallback-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const canonicalA = path.join(root, "canonical-a.txt");
  const canonicalB = path.join(root, "canonical-b.txt");
  const fallbackA = path.join(root, "denied-a.txt");
  const fallbackB = path.join(root, "denied-b.txt");
  await Promise.all([
    writeFile(canonicalA, "a"),
    writeFile(canonicalB, "b"),
    symlink(path.basename(fallbackA), fallbackA),
    symlink(path.basename(fallbackB), fallbackB),
  ]);

  const unavailable = new Set([fallbackA, fallbackB]);
  const canonicalized: string[] = [];
  const started: string[] = [];
  const releases = new Map<string, Deferred>();
  let active = 0;
  let maxActive = 0;
  const rpc = {
    async request(method: string, params: any) {
      assert.equal(method, "mutationKey");
      canonicalized.push(params.path);
      return unavailable.has(params.path)
        ? { available: false }
        : { available: true, key: params.path };
    },
    async requestWithBody(_method: string, params: any, body: Buffer) {
      active++;
      maxActive = Math.max(maxActive, active);
      started.push(params.path);
      const release = deferred();
      releases.set(params.path, release);
      await release.promise;
      active--;
      return { bytes: body.length };
    },
  };
  const tools = createSandboxToolDefinitions(root, async () => rpc as any);
  const write = (id: string, filePath: string) => tools.write.execute(
    id,
    { path: filePath, content: id },
    undefined,
    undefined,
    context(root),
  );

  const firstCanonical = write("canonical-a", canonicalA);
  await waitFor(() => started.includes(canonicalA), "first canonical write did not start");
  const firstFallback = write("fallback-a", fallbackA);
  await waitFor(() => canonicalized.includes(fallbackA), "fallback did not finish canonicalization");
  await flush();
  const secondCanonical = write("canonical-b", canonicalB);
  await waitFor(() => canonicalized.includes(canonicalB), "second canonical write did not canonicalize");
  await flush();
  assert.deepEqual(started, [canonicalA]);

  releases.get(canonicalA)!.resolve();
  await waitFor(() => started.includes(fallbackA), "exclusive fallback did not start after the active shared mutation");
  assert.equal(started.includes(canonicalB), false, "a later shared mutation bypassed the waiting exclusive fallback");

  const secondFallback = write("fallback-b", fallbackB);
  await waitFor(() => canonicalized.includes(fallbackB), "second fallback did not canonicalize");
  await flush();
  assert.equal(started.includes(fallbackB), false, "fallback mutations overlapped");

  releases.get(fallbackA)!.resolve();
  await waitFor(() => started.includes(canonicalB), "queued canonical mutation did not resume");
  assert.equal(started.includes(fallbackB), false, "fallback overlapped a canonical sandbox mutation");
  releases.get(canonicalB)!.resolve();
  await waitFor(() => started.includes(fallbackB), "second fallback did not resume");
  releases.get(fallbackB)!.resolve();

  await Promise.all([firstCanonical, firstFallback, secondCanonical, secondFallback]);
  assert.equal(maxActive, 1);
  assert.deepEqual(started, [canonicalA, fallbackA, canonicalB, fallbackB]);
});

test("cancellation retains the shared mutation lock until helper settlement", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-mutation-cancel-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "cancel.txt");
  await writeFile(target, "before");

  const firstStarted = deferred();
  const settleFirst = deferred();
  let writeCalls = 0;
  const rpc = {
    async request(method: string) {
      assert.equal(method, "mutationKey");
      return { available: true, key: target };
    },
    async requestWithBody(_method: string, _params: any, body: Buffer, signal?: AbortSignal) {
      writeCalls++;
      if (writeCalls === 1) {
        firstStarted.resolve();
        await settleFirst.promise;
        if (signal?.aborted) throw new Error("Operation aborted");
      }
      return { bytes: body.length };
    },
  };
  const tools = createSandboxToolDefinitions(root, async () => rpc as any);
  const controller = new AbortController();
  const first = tools.write.execute(
    "cancelled",
    { path: target, content: "stale" },
    controller.signal,
    undefined,
    context(root),
  );
  const firstOutcome = first.then(() => undefined, (error) => error);
  await firstStarted.promise;
  controller.abort();

  const second = tools.write.execute("new", { path: target, content: "new" }, undefined, undefined, context(root));
  await flush();
  assert.equal(writeCalls, 1, "the second write started before cancelled helper work settled");

  settleFirst.resolve();
  const firstError = await firstOutcome;
  assert.ok(firstError instanceof Error);
  assert.match(firstError.message, /Operation aborted/);
  await second;
  assert.equal(writeCalls, 2);
});

test("aborted canonicalization does not enter fallback mutation mode", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-mutation-key-cancel-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, "target.txt");
  const canonicalizationStarted = deferred();
  const finishCanonicalization = deferred();
  let writeCalls = 0;
  const rpc = {
    async request(method: string) {
      assert.equal(method, "mutationKey");
      canonicalizationStarted.resolve();
      await finishCanonicalization.promise;
      return { available: false };
    },
    async requestWithBody() {
      writeCalls++;
      return { bytes: 0 };
    },
  };
  const tools = createSandboxToolDefinitions(root, async () => rpc as any);
  const controller = new AbortController();
  const mutation = tools.write.execute(
    "aborted-key",
    { path: target, content: "blocked" },
    controller.signal,
    undefined,
    context(root),
  );
  await canonicalizationStarted.promise;
  controller.abort();
  finishCanonicalization.resolve();
  await assert.rejects(mutation, /Operation aborted/);
  assert.equal(writeCalls, 0);
});
