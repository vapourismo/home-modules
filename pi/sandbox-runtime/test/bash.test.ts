import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { access, mkdtemp, rm } from "node:fs/promises";
import { EOL, tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test, { after } from "node:test";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import { createSandboxBashOperations } from "../src/bash.ts";

const originalWrapWithSandboxArgv = SandboxManager.wrapWithSandboxArgv;
const originalGetSandboxViolationStore = SandboxManager.getSandboxViolationStore;
const originalCleanupAfterCommand = SandboxManager.cleanupAfterCommand;

const testViolation = {
  line: "sandbox lifecycle test violation",
  command: "test",
  timestamp: new Date(0),
};
const testDiagnostic = ["<sandbox_violations>", testViolation.line, "</sandbox_violations>"].join(EOL);
const emptyViolationCommandIdPrefix = "bash-empty-violation-store-test";
const emptyViolationLookups: Array<{ commandId: string; abortListenerCount: number }> = [];
let emptyViolationSignal: AbortSignal | undefined;
const testViolationStore = {
  getViolationsForCommand(commandId: string) {
    if (commandId.startsWith(`${emptyViolationCommandIdPrefix}:`)) {
      emptyViolationLookups.push({
        commandId,
        abortListenerCount: emptyViolationSignal
          ? getEventListeners(emptyViolationSignal, "abort").length
          : -1,
      });
      return [];
    }
    return [testViolation];
  },
  subscribe() {
    return () => {};
  },
};
const wrappedShellPaths: Array<string | undefined> = [];
const wrappedCwds: Array<string | undefined> = [];

SandboxManager.wrapWithSandboxArgv = async (
  command: string,
  binShell,
  _customConfig,
  _signal,
  cwd,
) => {
  wrappedShellPaths.push(typeof binShell === "string" ? binShell : undefined);
  wrappedCwds.push(cwd);
  return {
    argv: [process.execPath, "-e", command],
    env: process.env,
  };
};
SandboxManager.getSandboxViolationStore = () => testViolationStore as any;
SandboxManager.cleanupAfterCommand = () => {};

after(() => {
  SandboxManager.wrapWithSandboxArgv = originalWrapWithSandboxArgv;
  SandboxManager.getSandboxViolationStore = originalGetSandboxViolationStore;
  SandboxManager.cleanupAfterCommand = originalCleanupAfterCommand;
});

function spawnInheritedDescendant(source: string, parentTail = ""): string {
  return `
    const { spawn } = require("node:child_process");
    const descendant = spawn(process.execPath, ["-e", ${JSON.stringify(source)}], { stdio: "inherit" });
    descendant.unref();
    ${parentTail}
  `;
}

function spawnInheritedDescendantAfterReady(source: string, exitCode = 0): string {
  return `
    const { spawn } = require("node:child_process");
    const descendant = spawn(process.execPath, ["-e", ${JSON.stringify(source)}], {
      stdio: ["ignore", "inherit", "inherit", "ipc"],
    });
    descendant.once("message", () => process.exit(${exitCode}));
  `;
}

function sentinelDescendant(sentinelPath: string, waitMilliseconds: number): string {
  return `
    const { writeFileSync } = require("node:fs");
    process.stdout.write("descendant ready\\n");
    setTimeout(() => writeFileSync(${JSON.stringify(sentinelPath)}, "survived"), ${waitMilliseconds});
    setTimeout(() => {}, 5_000);
  `;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

test("forwards a configured shell path and preserves the default when omitted", async () => {
  const initialCallCount = wrappedShellPaths.length;
  const configured = createSandboxBashOperations(
    "bash-custom-shell-test",
    undefined,
    "/test/configured-shell",
  );
  const defaulted = createSandboxBashOperations("bash-default-shell-test");

  await configured.exec("process.exit(0)", process.cwd(), { onData() {} });
  await defaulted.exec("process.exit(0)", process.cwd(), { onData() {} });

  assert.deepEqual(wrappedShellPaths.slice(initialCallCount), [
    "/test/configured-shell",
    undefined,
  ]);
});

test("forwards the effective child cwd to Sandbox Runtime", async () => {
  const initialCallCount = wrappedCwds.length;
  const operations = createSandboxBashOperations("bash-effective-cwd-test");

  await operations.exec("process.exit(0)", process.cwd(), { onData() {} });

  assert.deepEqual(wrappedCwds.slice(initialCallCount), [process.cwd()]);
});

test("returns after a parent exits while a quiet descendant holds inherited pipes", { timeout: 3_000 }, async () => {
  const diagnostics: string[] = [];
  const operations = createSandboxBashOperations(
    "bash-quiet-descendant-test",
    (diagnostic) => diagnostics.push(diagnostic),
  );
  const chunks: Buffer[] = [];
  const command = spawnInheritedDescendant(
    "setTimeout(() => {}, 1_500);",
    'process.stdout.write("parent exited\\n");',
  );
  const startedAt = Date.now();

  const result = await operations.exec(command, process.cwd(), {
    onData: (chunk) => chunks.push(chunk),
    timeout: 1,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(Buffer.concat(chunks).toString("utf8"), "parent exited\n");
  assert.deepEqual(diagnostics, [testDiagnostic]);
  assert.ok(Date.now() - startedAt < 1_000, "execution should finish before its one-second timeout");
});

test("retains descendant output that keeps arriving during the post-exit idle window", { timeout: 3_000 }, async () => {
  const diagnostics: string[] = [];
  const operations = createSandboxBashOperations(
    "bash-trailing-output-test",
    (diagnostic) => diagnostics.push(diagnostic),
  );
  const chunks: Buffer[] = [];
  const descendant = `
    process.send("ready");
    process.once("disconnect", () => {
      setTimeout(() => process.stdout.write("late one\\n"), 10);
      setTimeout(() => process.stderr.write("late two\\n"), 80);
      setTimeout(() => process.stdout.write("late three\\n"), 150);
    });
  `;
  const command = spawnInheritedDescendantAfterReady(descendant, 7);

  const result = await operations.exec(command, process.cwd(), {
    onData: (chunk) => chunks.push(chunk),
    timeout: 1,
  });

  assert.equal(result.exitCode, 7);
  const output = Buffer.concat(chunks).toString("utf8");
  assert.match(output, /late one/);
  assert.match(output, /late two/);
  assert.match(output, /late three/);
  assert.doesNotMatch(output, /sandbox lifecycle test violation|sandbox_violations/);
  assert.deepEqual(diagnostics, [testDiagnostic]);
});

test("stops timeout and abort handlers before collecting post-exit violations", { timeout: 3_000 }, async () => {
  const diagnostics: string[] = [];
  const operations = createSandboxBashOperations(
    emptyViolationCommandIdPrefix,
    (diagnostic) => diagnostics.push(diagnostic),
  );
  const controller = new AbortController();
  const initialLookupCount = emptyViolationLookups.length;
  emptyViolationSignal = controller.signal;

  try {
    const result = await operations.exec("process.exit(0)", process.cwd(), {
      onData() {},
      signal: controller.signal,
      timeout: 0.2,
    });
    assert.equal(result.exitCode, 0);
  } finally {
    emptyViolationSignal = undefined;
  }

  const lookups = emptyViolationLookups.slice(initialLookupCount);
  assert.ok(lookups.length > 0, "the empty violation store should be queried");
  assert.ok(lookups.every(({ commandId }) => commandId.startsWith(`${emptyViolationCommandIdPrefix}:`)));
  assert.deepEqual(lookups.map(({ abortListenerCount }) => abortListenerCount), lookups.map(() => 0));
  assert.deepEqual(diagnostics, []);
});

test("timeout kills the parent and its inherited descendant process group", { timeout: 4_000 }, async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "pi-bash-timeout-"));
  const sentinelPath = path.join(directory, "descendant-survived");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const diagnostics: string[] = [];
  const operations = createSandboxBashOperations(
    "bash-timeout-group-test",
    (diagnostic) => diagnostics.push(diagnostic),
  );
  let output = "";
  const command = spawnInheritedDescendant(
    sentinelDescendant(sentinelPath, 500),
    "setTimeout(() => {}, 5_000);",
  );

  await assert.rejects(
    operations.exec(command, process.cwd(), {
      onData: (chunk) => { output += chunk.toString("utf8"); },
      timeout: 0.2,
    }),
    (error: Error) => {
      assert.equal(error.message, "timeout:0.2");
      assert.doesNotMatch(error.message, /sandbox lifecycle test violation|sandbox_violations/);
      return true;
    },
  );
  assert.match(output, /descendant ready/);
  assert.doesNotMatch(output, /sandbox lifecycle test violation|sandbox_violations/);
  assert.deepEqual(diagnostics, [testDiagnostic]);
  await delay(600);
  assert.equal(await pathExists(sentinelPath), false);
});

test("abort kills the parent and its inherited descendant process group", { timeout: 4_000 }, async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "pi-bash-abort-"));
  const sentinelPath = path.join(directory, "descendant-survived");
  t.after(() => rm(directory, { recursive: true, force: true }));
  const diagnostics: string[] = [];
  const operations = createSandboxBashOperations(
    "bash-abort-group-test",
    (diagnostic) => diagnostics.push(diagnostic),
  );
  const controller = new AbortController();
  let output = "";
  const command = spawnInheritedDescendant(
    sentinelDescendant(sentinelPath, 500),
    "setTimeout(() => {}, 5_000);",
  );

  await assert.rejects(
    operations.exec(command, process.cwd(), {
      onData: (chunk) => {
        output += chunk.toString("utf8");
        if (output.includes("descendant ready")) controller.abort();
      },
      signal: controller.signal,
    }),
    (error: Error) => {
      assert.equal(error.message, "aborted");
      assert.doesNotMatch(error.message, /sandbox lifecycle test violation|sandbox_violations/);
      return true;
    },
  );
  assert.match(output, /descendant ready/);
  assert.doesNotMatch(output, /sandbox lifecycle test violation|sandbox_violations/);
  assert.deepEqual(diagnostics, [testDiagnostic]);
  await delay(550);
  assert.equal(await pathExists(sentinelPath), false);
});
