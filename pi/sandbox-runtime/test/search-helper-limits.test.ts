import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { type TestContext } from "node:test";
import { HelperRpcClient, HelperRpcError, RPC_FRAME_PAYLOAD_LIMIT } from "../src/rpc.ts";
import {
  COMMAND_OUTPUT_MAX_BYTES,
  GREP_MAX_LINE_LENGTH,
} from "../src/search-limits.mjs";
import { createSandboxToolDefinitions } from "../src/tools.ts";

const HELPER_PATH = fileURLToPath(new URL("../helper.mjs", import.meta.url));

async function writeFakeSearchCommands(binDir: string): Promise<void> {
  await writeFile(path.join(binDir, "fd"), `#!${process.execPath}
const args = process.argv.slice(2);
if (!args.includes("--print0")) {
  process.stderr.write("missing --print0");
  process.exit(2);
}
const separator = args.indexOf("--");
const pattern = args[separator + 1];
const root = args[separator + 2];
const control = String.fromCharCode;
const nul = control(0);
const emit = (value) => process.stdout.write(value + nul);
if (pattern === "count") {
  for (let index = 0; index < 20; index++) emit("file-" + String(index).padStart(3, "0"));
} else if (pattern === "controls") {
  [
    "line" + control(0x0a) + "break",
    "carriage" + control(0x0d) + "return",
    "tab" + control(0x09) + "name",
    "escape" + control(0x1b) + "name",
    "literal" + control(0x5c) + "name",
    "unicode-café-猫",
  ].forEach(emit);
} else if (pattern === "display") {
  [
    root + "/01-new" + control(0x0a) + "line",
    root + "/02-carriage" + control(0x0d) + "return",
    root + "/03-tab" + control(0x09) + "name",
    root + "/04-escape" + control(0x1b) + "name",
    root + "/05-literal" + control(0x5c) + "n",
    root + "/06-café-猫",
    root + "/07-directory" + control(0x0a) + "猫/",
  ].forEach(emit);
} else if (pattern === "overflow") {
  process.stdout.write("complete-path" + nul + "x".repeat(${COMMAND_OUTPUT_MAX_BYTES + 4096}));
  setInterval(() => {}, 1000);
} else if (pattern === "unterminated") {
  process.stdout.write("complete-path" + nul + "partial-path");
} else if (pattern === "stderr") {
  process.stderr.write("e".repeat(${COMMAND_OUTPUT_MAX_BYTES + 4096}));
  emit("stderr-result");
} else if (pattern === "empty-overflow") {
  process.stdout.write("x".repeat(${COMMAND_OUTPUT_MAX_BYTES + 4096}));
  setInterval(() => {}, 1000);
} else if (pattern === "failure") {
  process.stderr.write("e".repeat(${COMMAND_OUTPUT_MAX_BYTES + 4096}));
  process.exitCode = 2;
}
`);
  await writeFile(path.join(binDir, "rg"), `#!${process.execPath}
const args = process.argv.slice(2);
const separator = args.indexOf("--");
const pattern = args[separator + 1];
const root = args[separator + 2];
const file = root + "/fixture.txt";
const emit = (type, line, text, filePath = file) => process.stdout.write(JSON.stringify({
  type,
  data: { path: { text: filePath }, line_number: line, lines: { text: text + "\\n" } },
}) + "\\n");
if (pattern === "context") {
  emit("context", 1, "one");
  emit("match", 2, "needle two");
  emit("context", 3, "three");
  emit("context", 3, "three duplicated");
  emit("match", 4, "needle four");
  emit("context", 5, "five");
} else if (pattern === "display") {
  const control = String.fromCharCode;
  const files = [
    root + "/01-new" + control(0x0a) + "line.txt",
    root + "/02-carriage" + control(0x0d) + "return.txt",
    root + "/03-tab" + control(0x09) + "name.txt",
    root + "/04-escape" + control(0x1b) + "name.txt",
    root + "/05-literal" + control(0x5c) + "n.txt",
    root + "/nested" + control(0x0a) + "folder/06-café-猫.txt",
  ];
  files.forEach((filePath, index) => emit("match", index + 1, "needle " + (index + 1), filePath));
} else if (pattern === "trailing") {
  for (let line = 1; line <= 10; line++) emit("match", line, "needle " + line);
} else if (pattern === "long") {
  emit("match", 1, "x".repeat(${GREP_MAX_LINE_LENGTH + 100}));
} else if (pattern === "aggregate") {
  for (let line = 1; line <= 100; line++) emit("match", line, "x".repeat(${GREP_MAX_LINE_LENGTH + 100}));
} else if (pattern === "oversized") {
  emit("match", 1, "x".repeat(${RPC_FRAME_PAYLOAD_LIMIT + 1024}));
  setInterval(() => {}, 1000);
} else if (pattern === "stderr") {
  process.stderr.write("e".repeat(${COMMAND_OUTPUT_MAX_BYTES + 4096}));
}
`);
  await Promise.all([
    chmod(path.join(binDir, "fd"), 0o755),
    chmod(path.join(binDir, "rg"), 0o755),
  ]);
}

async function createHarness(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), "pi-search-helper-limits-"));
  const binDir = path.join(root, "bin");
  await mkdir(binDir);
  await writeFile(path.join(root, "fixture.txt"), "fixture\n");
  await writeFakeSearchCommands(binDir);
  const child = spawn(process.execPath, [HELPER_PATH], {
    cwd: root,
    env: { ...process.env, PATH: binDir },
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.on("data", () => {});
  const rpc = new HelperRpcClient(child);
  t.after(async () => {
    await rpc.close();
    await rm(root, { recursive: true, force: true });
  });
  return {
    root,
    rpc,
    tools: createSandboxToolDefinitions(root, async () => rpc),
  };
}

function text(result: any): string {
  return result.content[0].text;
}

test("find bounds count and byte capture and reports stdout/stderr truncation", async (t) => {
  const { root, rpc, tools } = await createHarness(t);

  const count = await rpc.request<any>("find", { path: root, pattern: "count", limit: 5 });
  assert.deepEqual(count.paths, ["file-000", "file-001", "file-002", "file-003", "file-004"]);
  assert.equal(count.limitReached, true);
  assert.equal(count.stdoutTruncated, false);

  const expectedControls = [
    "line\nbreak",
    "carriage\rreturn",
    "tab\tname",
    "escape\x1bname",
    "literal\\name",
    "unicode-café-猫",
  ];
  const controls = await rpc.request<any>("find", { path: root, pattern: "controls", limit: 1000 });
  assert.deepEqual(controls.paths, expectedControls);
  assert.equal(controls.paths.length, expectedControls.length);
  assert.equal(controls.limitReached, false);

  const controlsLimited = await rpc.request<any>("find", { path: root, pattern: "controls", limit: 3 });
  assert.deepEqual(controlsLimited.paths, expectedControls.slice(0, 3));
  assert.equal(controlsLimited.limitReached, true);

  const unterminated = await rpc.request<any>("find", { path: root, pattern: "unterminated", limit: 1000 });
  assert.deepEqual(unterminated.paths, ["complete-path"]);
  assert.equal(unterminated.stdoutTruncated, false);

  const overflow = await rpc.request<any>("find", { path: root, pattern: "overflow", limit: 1000 });
  assert.deepEqual(overflow.paths, ["complete-path"]);
  assert.equal(overflow.stdoutTruncated, true);
  assert.equal(Buffer.byteLength(overflow.paths.join("\n")) < COMMAND_OUTPUT_MAX_BYTES, true);
  assert.deepEqual(await rpc.request("probe", {}), { node: process.version });

  const emptyOverflow = await tools.find.execute(
    "empty-overflow",
    { path: root, pattern: "empty-overflow" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.match(text(emptyOverflow), /^No files found matching pattern/);
  assert.match(text(emptyOverflow), /helper output limit reached/);
  assert.equal((emptyOverflow.details as any).stdoutTruncated, true);

  const stderr = await tools.find.execute(
    "stderr",
    { path: root, pattern: "stderr" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.match(text(stderr), /fd diagnostics were truncated/);
  assert.equal((stderr.details as any).stderrTruncated, true);

  await assert.rejects(
    rpc.request("find", { path: root, pattern: "failure", limit: 1000 }),
    (error: unknown) => {
      assert.ok(error instanceof HelperRpcError);
      assert.match(error.message, /stderr truncated at 51200 bytes/);
      return true;
    },
  );
  assert.deepEqual(await rpc.request("probe", {}), { node: process.version });
});

test("ls, find, and grep render escaped control characters in paths", async (t) => {
  const { root, rpc, tools } = await createHarness(t);
  const control = String.fromCharCode;
  const listingPath = path.join(root, "display-listing");
  await mkdir(listingPath);
  const rawNames = [
    "01-new" + control(0x0a) + "line",
    "02-carriage" + control(0x0d) + "return",
    "03-tab" + control(0x09) + "name",
    "04-escape" + control(0x1b) + "name",
    "05-literal" + control(0x5c) + "n",
    "06-café-猫",
    "07-directory" + control(0x0a) + "猫",
  ];
  await Promise.all([
    ...rawNames.slice(0, -1).map((name) => writeFile(path.join(listingPath, name), "")),
    mkdir(path.join(listingPath, rawNames.at(-1)!)),
  ]);

  const rawListing = await rpc.request<any>("ls", { path: listingPath, limit: 100 });
  assert.deepEqual(rawListing.entries.map((entry: any) => entry.name), rawNames);
  const listing = await tools.ls.execute(
    "display-ls",
    { path: listingPath, limit: 100 },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  const expectedListing = [
    "01-new\\nline",
    "02-carriage\\rreturn",
    "03-tab\\tname",
    "04-escape\\x1bname",
    "05-literal\\\\n",
    "06-café-猫",
    "07-directory\\n猫/",
  ];
  assert.equal(text(listing), expectedListing.join("\n"));
  assert.equal(text(listing).split("\n").length, rawNames.length);

  const rawFindPaths = [
    root + "/01-new" + control(0x0a) + "line",
    root + "/02-carriage" + control(0x0d) + "return",
    root + "/03-tab" + control(0x09) + "name",
    root + "/04-escape" + control(0x1b) + "name",
    root + "/05-literal" + control(0x5c) + "n",
    root + "/06-café-猫",
    root + "/07-directory" + control(0x0a) + "猫/",
  ];
  const rawFind = await rpc.request<any>("find", { path: root, pattern: "display", limit: 1000 });
  assert.deepEqual(rawFind.paths, rawFindPaths);
  const find = await tools.find.execute(
    "display-find",
    { path: root, pattern: "display" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.equal(text(find), expectedListing.join("\n"));
  assert.equal(text(find).split("\n").length, rawFindPaths.length);

  const expectedGrepPaths = [
    "01-new\\nline.txt",
    "02-carriage\\rreturn.txt",
    "03-tab\\tname.txt",
    "04-escape\\x1bname.txt",
    "05-literal\\\\n.txt",
    "nested\\nfolder/06-café-猫.txt",
  ];
  const rawGrep = await rpc.request<any>("grep", {
    path: root,
    pattern: "display",
    limit: 100,
    context: 0,
  });
  assert.deepEqual(rawGrep.lines.map((line: any) => line.displayPath), expectedGrepPaths);
  const grep = await tools.grep.execute(
    "display-grep",
    { path: root, pattern: "display" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  const expectedGrep = expectedGrepPaths.map((displayPath, index) =>
    `${displayPath}:${index + 1}: needle ${index + 1}`);
  assert.equal(text(grep), expectedGrep.join("\n"));
  assert.equal(text(grep).split("\n").length, expectedGrepPaths.length);
});

test("grep streams bounded flat context and reports every truncation reason", async (t) => {
  const { root, rpc, tools } = await createHarness(t);

  const context = await rpc.request<any>("grep", {
    path: root,
    pattern: "context",
    limit: 100,
    context: 1,
  });
  assert.deepEqual(context.lines.map((line: any) => [line.lineNumber, line.match, line.text]), [
    [1, false, "one"],
    [2, true, "needle two"],
    [3, false, "three"],
    [4, true, "needle four"],
    [5, false, "five"],
  ]);

  const trailing = await tools.grep.execute(
    "trailing",
    { path: root, pattern: "trailing", limit: 3, context: 2 },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.deepEqual(text(trailing).split("\n\n", 1)[0]!.split("\n"), [
    "fixture.txt:1: needle 1",
    "fixture.txt:2: needle 2",
    "fixture.txt:3: needle 3",
    "fixture.txt-4- needle 4",
    "fixture.txt-5- needle 5",
  ]);
  assert.equal((trailing.details as any).matchLimitReached, 3);
  assert.match(text(trailing), /maximum reached; refine the path or pattern/);

  const long = await tools.grep.execute(
    "long",
    { path: root, pattern: "long" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.equal((long.details as any).linesTruncated, true);
  assert.match(text(long), /\.\.\. \[truncated\]/);

  const aggregate = await tools.grep.execute(
    "aggregate",
    { path: root, pattern: "aggregate" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.equal((aggregate.details as any).outputTruncated, true);
  assert.ok(Buffer.byteLength(text(aggregate).split("\n\n", 1)[0]!, "utf8") <= COMMAND_OUTPUT_MAX_BYTES);
  assert.match(text(aggregate), /helper output limit reached/);
  assert.deepEqual(await rpc.request("probe", {}), { node: process.version });

  const oversized = await tools.grep.execute(
    "oversized",
    { path: root, pattern: "oversized" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.match(text(oversized), /^No matches found/);
  assert.match(text(oversized), /oversized ripgrep event was discarded/i);
  assert.equal((oversized.details as any).eventTruncated, true);
  assert.deepEqual(await rpc.request("probe", {}), { node: process.version });

  const stderr = await tools.grep.execute(
    "stderr",
    { path: root, pattern: "stderr" },
    undefined,
    undefined,
    { cwd: root } as any,
  );
  assert.match(text(stderr), /^No matches found/);
  assert.match(text(stderr), /Ripgrep diagnostics were truncated/);
  assert.equal((stderr.details as any).stderrTruncated, true);
});
