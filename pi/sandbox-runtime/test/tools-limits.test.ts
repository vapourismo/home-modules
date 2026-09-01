import assert from "node:assert/strict";
import test from "node:test";
import {
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  formatSize,
} from "@earendil-works/pi-coding-agent";
import { RPC_READ_CONCURRENCY_LIMIT, RPC_STREAM_PAYLOAD_LIMIT } from "../src/rpc.ts";
import { createSandboxToolDefinitions } from "../src/tools.ts";
import {
  COMMAND_OUTPUT_MAX_BYTES,
  FIND_MAX_LIMIT,
  GREP_MAX_CONTEXT,
  GREP_MAX_LIMIT,
  GREP_MAX_LINE_LENGTH,
  LS_MAX_LIMIT,
} from "../src/search-limits.mjs";

async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

test("sandbox search metadata preserves built-in semantics and states hard limits", () => {
  const cwd = "/workspace";
  const sandboxTools = createSandboxToolDefinitions(cwd, async () => {
    throw new Error("provider should not be called");
  });
  const builtinTools = {
    ls: createLsToolDefinition(cwd),
    find: createFindToolDefinition(cwd),
    grep: createGrepToolDefinition(cwd),
  };
  const outputLimit = formatSize(COMMAND_OUTPUT_MAX_BYTES);

  assert.match(sandboxTools.ls.description, /sorted alphabetically \(case-insensitively\)/i);
  assert.match(sandboxTools.ls.description, /with '\/' suffixes for directories/i);
  assert.match(sandboxTools.ls.description, /includes dotfiles/i);
  assert.ok(sandboxTools.ls.description.includes(`hard maximum is ${LS_MAX_LIMIT} entries`));
  assert.ok(sandboxTools.ls.description.includes(`rendered output is bounded to ${outputLimit}`));

  assert.match(sandboxTools.find.description, /returns matching file paths relative to the search directory/i);
  assert.match(sandboxTools.find.description, /respects \.gitignore/i);
  assert.ok(sandboxTools.find.description.includes(`hard maximum is ${FIND_MAX_LIMIT} results`));
  assert.ok(sandboxTools.find.description.includes(`Helper capture is bounded to ${outputLimit}`));
  assert.ok(sandboxTools.find.description.includes(`rendered output is also bounded to ${outputLimit}`));

  assert.match(sandboxTools.grep.description, /returns matching lines with file paths and line numbers/i);
  assert.match(sandboxTools.grep.description, /respects \.gitignore/i);
  assert.ok(sandboxTools.grep.description.includes(`up to ${GREP_MAX_CONTEXT} context lines per side`));
  assert.ok(sandboxTools.grep.description.includes(`hard maximum is ${GREP_MAX_LIMIT} matches`));
  assert.ok(sandboxTools.grep.description.includes(`rendered output is bounded to ${outputLimit}`));
  assert.ok(sandboxTools.grep.description.includes(
    `each retained line is limited to ${GREP_MAX_LINE_LENGTH} characters`,
  ));

  const softLimitLanguage = /Output is truncated .* \(whichever is hit first\)/i;
  for (const name of ["ls", "find", "grep"] as const) {
    assert.equal(sandboxTools[name].promptSnippet, builtinTools[name].promptSnippet);
    assert.deepEqual((sandboxTools[name] as any).promptGuidelines, (builtinTools[name] as any).promptGuidelines);
    assert.match(sandboxTools[name].description, /hard maximum/i);
    assert.doesNotMatch(sandboxTools[name].description, softLimitLanguage);
  }
});

test("search schemas use integer hard limits and host validation runs before RPC", async () => {
  let providerCalls = 0;
  const tools = createSandboxToolDefinitions(
    "/workspace",
    async () => {
      providerCalls++;
      throw new Error("provider should not be called");
    },
  );

  assert.deepEqual(
    {
      type: (tools.ls.parameters.properties.limit as any).type,
      minimum: (tools.ls.parameters.properties.limit as any).minimum,
      maximum: (tools.ls.parameters.properties.limit as any).maximum,
    },
    { type: "integer", minimum: 1, maximum: LS_MAX_LIMIT },
  );
  assert.deepEqual(
    {
      type: (tools.find.parameters.properties.limit as any).type,
      minimum: (tools.find.parameters.properties.limit as any).minimum,
      maximum: (tools.find.parameters.properties.limit as any).maximum,
    },
    { type: "integer", minimum: 1, maximum: FIND_MAX_LIMIT },
  );
  assert.deepEqual(
    {
      type: (tools.grep.parameters.properties.limit as any).type,
      minimum: (tools.grep.parameters.properties.limit as any).minimum,
      maximum: (tools.grep.parameters.properties.limit as any).maximum,
    },
    { type: "integer", minimum: 1, maximum: GREP_MAX_LIMIT },
  );
  assert.deepEqual(
    {
      type: (tools.grep.parameters.properties.context as any).type,
      minimum: (tools.grep.parameters.properties.context as any).minimum,
      maximum: (tools.grep.parameters.properties.context as any).maximum,
    },
    { type: "integer", minimum: 0, maximum: GREP_MAX_CONTEXT },
  );

  const calls: Array<["ls" | "find" | "grep", Record<string, unknown>, RegExp]> = [
    ["ls", { path: ".", limit: 0 }, /ls limit must be an integer/],
    ["ls", { path: ".", limit: 1.5 }, /ls limit must be an integer/],
    ["ls", { path: ".", limit: LS_MAX_LIMIT + 1 }, /ls limit must be an integer/],
    ["find", { pattern: "*", limit: Number.NaN }, /find limit must be an integer/],
    ["find", { pattern: "*", limit: FIND_MAX_LIMIT + 1 }, /find limit must be an integer/],
    ["grep", { pattern: "x", limit: Infinity }, /grep limit must be an integer/],
    ["grep", { pattern: "x", limit: GREP_MAX_LIMIT + 1 }, /grep limit must be an integer/],
    ["grep", { pattern: "x", context: -1 }, /grep context must be an integer/],
    ["grep", { pattern: "x", context: 0.5 }, /grep context must be an integer/],
    ["grep", { pattern: "x", context: GREP_MAX_CONTEXT + 1 }, /grep context must be an integer/],
  ];
  for (const [name, params, message] of calls) {
    await assert.rejects(
      (tools[name] as any).execute("invalid", params, undefined, undefined, { cwd: "/workspace" }),
      message,
    );
  }
  assert.equal(providerCalls, 0);
});

test("tool reads hold four slots through processing and queued abort does not start RPC work", async () => {
  let active = 0;
  let maxActive = 0;
  let maxDeclaredBytes = 0;
  let callCount = 0;
  const releases: Array<() => void> = [];
  const rpc = {
    requestBinary: async () => {
      callCount++;
      active++;
      maxActive = Math.max(maxActive, active);
      maxDeclaredBytes = Math.max(maxDeclaredBytes, active * RPC_STREAM_PAYLOAD_LIMIT);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      return {
        data: Buffer.from("ok"),
        metadata: {
          kind: "text",
          path: "/workspace/file.txt",
          mimeType: null,
          startLine: 1,
          totalFileLines: 1,
          exactTotal: true,
          hasMore: false,
          outputLines: 1,
          truncated: false,
          truncatedBy: null,
          firstLineExceedsLimit: false,
          firstLineBytes: 2,
        },
        result: {},
      };
    },
  };
  const tools = createSandboxToolDefinitions(
    "/workspace",
    async () => rpc as any,
  );

  const firstFour = Array.from({ length: RPC_READ_CONCURRENCY_LIMIT }, (_, index) =>
    tools.read.execute(String(index), { path: "file.txt" }, undefined, undefined, { cwd: "/workspace" } as any));
  await flush();
  assert.equal(callCount, RPC_READ_CONCURRENCY_LIMIT);

  const abortedController = new AbortController();
  const aborted = tools.read.execute(
    "aborted",
    { path: "file.txt" },
    abortedController.signal,
    undefined,
    { cwd: "/workspace" } as any,
  );
  const queued = tools.read.execute("queued", { path: "file.txt" }, undefined, undefined, { cwd: "/workspace" } as any);
  await flush();
  assert.equal(callCount, RPC_READ_CONCURRENCY_LIMIT);
  abortedController.abort();
  await assert.rejects(aborted, /Operation aborted/);
  assert.equal(callCount, RPC_READ_CONCURRENCY_LIMIT);

  releases.shift()!();
  await flush();
  assert.equal(callCount, RPC_READ_CONCURRENCY_LIMIT + 1);
  while (releases.length) releases.shift()!();
  await Promise.all([...firstFour, queued]);

  assert.equal(maxActive, RPC_READ_CONCURRENCY_LIMIT);
  assert.equal(maxDeclaredBytes, 32 * 1024 * 1024);
});
