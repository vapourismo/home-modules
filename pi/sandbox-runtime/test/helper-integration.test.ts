import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  FILE_TOO_LARGE,
  HelperRpcClient,
  HelperRpcError,
  RPC_STREAM_PAYLOAD_LIMIT,
} from "../src/rpc.ts";
import { compareLsNames } from "../src/ls-selection.mjs";
import { createSandboxToolDefinitions } from "../src/tools.ts";
import {
  FIND_MAX_LIMIT,
  GREP_MAX_CONTEXT,
  GREP_MAX_LIMIT,
  LS_MAX_LIMIT,
} from "../src/search-limits.mjs";

const HELPER_PATH = fileURLToPath(new URL("../helper.mjs", import.meta.url));

test("helper remains usable when fd and rg are absent", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-helper-"));
  const emptyPath = path.join(root, "empty-path");
  await mkdir(emptyPath);

  assert.equal(path.isAbsolute(process.execPath), true);
  const child = spawn(process.execPath, [HELPER_PATH], {
    cwd: root,
    env: { ...process.env, PATH: emptyPath },
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const rpc = new HelperRpcClient(child);
  t.after(async () => {
    await rpc.close();
    await rm(root, { recursive: true, force: true });
  });

  assert.deepEqual(await rpc.request("probe", {}), { node: process.version });

  for (const [method, params, message] of [
    ["ls", { path: root, limit: LS_MAX_LIMIT + 1 }, /ls limit must be an integer/],
    ["find", { path: root, pattern: "*", limit: FIND_MAX_LIMIT + 1 }, /find limit must be an integer/],
    ["find", { path: root, pattern: "*", limit: 1.5 }, /find limit must be an integer/],
    ["grep", { path: root, pattern: "x", limit: GREP_MAX_LIMIT + 1 }, /grep limit must be an integer/],
    ["grep", { path: root, pattern: "x", context: GREP_MAX_CONTEXT + 1 }, /grep context must be an integer/],
  ] as const) {
    await assert.rejects(rpc.request(method, params), message);
  }
  assert.deepEqual(await rpc.request("probe", {}), { node: process.version });

  const filePath = path.join(root, "sample.txt");
  assert.deepEqual(
    await rpc.requestWithBody("write", { path: filePath }, Buffer.from("before\n")),
    { bytes: 7 },
  );
  const aliasPath = path.join(root, "sample-link.txt");
  const missingPath = path.join(root, "missing", "new.txt");
  const unavailablePath = path.join(root, "canonical-loop.txt");
  await Promise.all([
    symlink(filePath, aliasPath),
    symlink(path.basename(unavailablePath), unavailablePath),
  ]);
  const notDirectoryPath = path.join(filePath, "child.txt");
  const [realKey, aliasKey, missingKey, notDirectoryKey, unavailableKey] = await Promise.all([
    rpc.request<any>("mutationKey", { path: filePath }),
    rpc.request<any>("mutationKey", { path: aliasPath }),
    rpc.request<any>("mutationKey", { path: missingPath }),
    rpc.request<any>("mutationKey", { path: notDirectoryPath }),
    rpc.request<any>("mutationKey", { path: unavailablePath }),
  ]);
  assert.deepEqual(realKey, { available: true, key: await realpath(filePath) });
  assert.deepEqual(aliasKey, realKey);
  assert.deepEqual(missingKey, { available: true, key: missingPath });
  assert.deepEqual(notDirectoryKey, { available: true, key: notDirectoryPath });
  assert.deepEqual(unavailableKey, { available: false });

  const initialRead = await rpc.requestBinary<{ kind: string }>("read", { paths: [filePath] });
  assert.equal(initialRead.data.toString("utf8"), "before\n");
  assert.equal(initialRead.metadata.kind, "text");

  await assert.rejects(
    rpc.request("find", { path: root, pattern: "*.txt" }),
    (error: unknown) => {
      assert.ok(error instanceof HelperRpcError);
      assert.equal(error.code, "ENOENT");
      assert.match(error.message, /find requires fd/);
      return true;
    },
  );
  assert.equal(rpc.isClosed, false);
  const listing = await rpc.request<{ entries: Array<{ name: string }> }>("ls", { path: root });
  assert.ok(listing.entries.some((entry) => entry.name === "sample.txt"));

  await assert.rejects(
    rpc.request("grep", { path: root, pattern: "before" }),
    (error: unknown) => {
      assert.ok(error instanceof HelperRpcError);
      assert.equal(error.code, "ENOENT");
      assert.match(error.message, /grep requires rg/);
      return true;
    },
  );
  assert.equal(rpc.isClosed, false);

  const tools = createSandboxToolDefinitions(root, async () => rpc);

  const plainReadPath = path.join(root, "read-collision.txt");
  const leadingReadPath = path.join(root, " read-collision.txt");
  const trailingReadPath = path.join(root, "read-collision.txt ");
  await Promise.all([
    writeFile(plainReadPath, "plain read"),
    writeFile(leadingReadPath, "leading read"),
    writeFile(trailingReadPath, "trailing read"),
  ]);
  const leadingRead = await tools.read.execute(
    "leading-space-read",
    { path: " read-collision.txt" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  const trailingRead = await tools.read.execute(
    "trailing-space-read",
    { path: "read-collision.txt " },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.equal((leadingRead.content[0] as any).text, "leading read");
  assert.equal((trailingRead.content[0] as any).text, "trailing read");
  assert.equal(await readFile(plainReadPath, "utf8"), "plain read");

  const plainWritePath = path.join(root, "write-collision.txt");
  const trailingWritePath = path.join(root, "write-collision.txt ");
  await Promise.all([
    writeFile(plainWritePath, "before\n"),
    writeFile(trailingWritePath, "before\n"),
  ]);
  await tools.write.execute(
    "trailing-space-write",
    { path: "write-collision.txt ", content: "after\n" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.equal(await readFile(trailingWritePath, "utf8"), "after\n");
  assert.equal(await readFile(plainWritePath, "utf8"), "before\n");

  const plainEditPath = path.join(root, "edit-collision.txt");
  const leadingEditPath = path.join(root, " edit-collision.txt");
  await Promise.all([
    writeFile(plainEditPath, "before\n"),
    writeFile(leadingEditPath, "before\n"),
  ]);
  await tools.edit.execute(
    "leading-space-edit",
    { path: " edit-collision.txt", edits: [{ oldText: "before", newText: "after" }] },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.equal(await readFile(leadingEditPath, "utf8"), "after\n");
  assert.equal(await readFile(plainEditPath, "utf8"), "before\n");

  const exactDirectory = path.join(root, "exact-directory");
  const nestedDirectory = path.join(exactDirectory, "folder");
  await mkdir(nestedDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(exactDirectory, ".dotfile"), ""),
    writeFile(path.join(exactDirectory, "Zulu.txt"), ""),
    symlink("folder", path.join(exactDirectory, "folder-link")),
    symlink("missing-target", path.join(exactDirectory, "broken-link")),
  ]);
  const exactListing = await tools.ls.execute(
    "exact-ls",
    { path: exactDirectory, limit: 4 },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.equal((exactListing.content[0] as any).text, ".dotfile\nfolder/\nfolder-link/\nZulu.txt");
  assert.equal(exactListing.details, undefined);

  const truncatedListing = await tools.ls.execute(
    "truncated-ls",
    { path: exactDirectory, limit: 3 },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  const truncatedText = (truncatedListing.content[0] as any).text as string;
  assert.equal(truncatedText.split("\n\n", 1)[0], ".dotfile\nfolder/\nfolder-link/");
  assert.equal((truncatedListing.details as any).entryLimitReached, 3);
  assert.match(truncatedText, /maximum reached; refine the path/);

  const largeDirectory = path.join(root, "large-directory");
  await mkdir(largeDirectory);
  const largeNames = Array.from({ length: LS_MAX_LIMIT + 10 }, (_, index) =>
    `entry-${String(LS_MAX_LIMIT + 9 - index).padStart(4, "0")}.txt`);
  await Promise.all(largeNames.map((name) => writeFile(path.join(largeDirectory, name), "")));
  const lateEarlyNames = ["aaa-important.txt", ".large-hidden"];
  await Promise.all(lateEarlyNames.map((name) => writeFile(path.join(largeDirectory, name), "")));
  const boundedListing = await tools.ls.execute(
    "bounded-ls",
    { path: largeDirectory },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  const listingText = (boundedListing.content[0] as any).text as string;
  const listedEntries = listingText.split("\n\n", 1)[0]!.split("\n");
  const expectedEntries = [...largeNames, ...lateEarlyNames].sort(compareLsNames).slice(0, LS_MAX_LIMIT);
  assert.equal(listedEntries.length, LS_MAX_LIMIT);
  assert.deepEqual(listedEntries, expectedEntries);
  assert.deepEqual(listedEntries, [...listedEntries].sort(compareLsNames));
  assert.equal((boundedListing.details as any).entryLimitReached, LS_MAX_LIMIT);
  assert.match(listingText, /maximum reached; refine the path/);
  assert.deepEqual(await rpc.request("probe", {}), { node: process.version });

  const editResult = await tools.edit.execute(
    "edit-test",
    { path: "sample.txt", edits: [{ oldText: "before", newText: "after" }] },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.match((editResult.content[0] as any).text, /Successfully replaced 1 block/);
  assert.equal(rpc.isClosed, false);

  const editedRead = await rpc.requestBinary("read", { paths: [filePath] });
  assert.equal(editedRead.data.toString("utf8"), "after\n");

  const largeTextPath = path.join(root, "large.txt");
  await writeFile(largeTextPath, Buffer.alloc(RPC_STREAM_PAYLOAD_LIMIT + 1024, "a\n"));
  const largeFirst = await tools.read.execute(
    "large-first",
    { path: "large.txt" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  const firstText = (largeFirst.content[0] as any).text as string;
  assert.ok(Buffer.byteLength(firstText) < 60 * 1024);
  assert.match(firstText, /of a larger file/);
  const largeOffset = await tools.read.execute(
    "large-offset",
    { path: "large.txt", offset: 3000, limit: 2 },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.match((largeOffset.content[0] as any).text, /More lines in file/);
  assert.equal(rpc.isClosed, false);

  const hugeLinePath = path.join(root, "huge-line.txt");
  await writeFile(hugeLinePath, Buffer.alloc(RPC_STREAM_PAYLOAD_LIMIT + 1, 0x78));
  const hugeLine = await tools.read.execute(
    "huge-line",
    { path: "huge-line.txt" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.match((hugeLine.content[0] as any).text, /larger than 50\.0KB/);

  const fullPath = path.join(root, "multi-chunk.txt");
  const fullBytes = Buffer.alloc(200 * 1024, 0x62);
  await writeFile(fullPath, fullBytes);
  const fullRead = await rpc.requestBinary<{ kind: string }>(
    "read",
    { paths: [fullPath], mode: "full" },
  );
  assert.deepEqual(fullRead.data, fullBytes);
  assert.equal(fullRead.metadata.kind, "full");

  const multiImagePath = path.join(root, "multi-chunk.png");
  const multiImageBytes = Buffer.alloc(200 * 1024);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(multiImageBytes);
  await writeFile(multiImagePath, multiImageBytes);
  const multiImage = await rpc.requestBinary<{ kind: string }>("read", { paths: [multiImagePath] });
  assert.deepEqual(multiImage.data, multiImageBytes);
  assert.equal(multiImage.metadata.kind, "image");

  const imagePath = path.join(root, "too-large.png");
  const imageBytes = Buffer.alloc(RPC_STREAM_PAYLOAD_LIMIT + 1);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(imageBytes);
  await writeFile(imagePath, imageBytes);
  await assert.rejects(
    rpc.requestBinary("read", { paths: [imagePath] }),
    (error: unknown) => error instanceof HelperRpcError && error.code === FILE_TOO_LARGE,
  );
  await assert.rejects(
    rpc.requestBinary("read", { paths: [largeTextPath], mode: "full" }),
    (error: unknown) => error instanceof HelperRpcError && error.code === FILE_TOO_LARGE,
  );
  await assert.rejects(
    tools.edit.execute(
      "oversized-edit",
      { path: "large.txt", edits: [{ oldText: "a", newText: "b" }] },
      undefined,
      undefined,
      { cwd: root } as any,
    ),
    (error: unknown) => error instanceof HelperRpcError && error.code === FILE_TOO_LARGE,
  );
  assert.deepEqual(await rpc.request("probe", {}), { node: process.version });

  const streamedWritePath = path.join(root, "streamed-write.bin");
  const streamedBody = Buffer.alloc(2 * 1024 * 1024, 0x63);
  await rpc.requestWithBody("write", { path: streamedWritePath }, streamedBody);
  assert.deepEqual(await readFile(streamedWritePath), streamedBody);

  const largeEditPath = path.join(root, "large-edit.txt");
  await writeFile(largeEditPath, `before\n${"z\n".repeat(1024 * 1024)}`);
  await tools.edit.execute(
    "large-edit",
    { path: "large-edit.txt", edits: [{ oldText: "before", newText: "after" }] },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.equal((await readFile(largeEditPath, "utf8")).startsWith("after\n"), true);
});
