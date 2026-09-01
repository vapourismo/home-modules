import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import sandboxRuntimeExtension from "../index.ts";

type Handler = (...args: any[]) => any;

function createHarness(cwd: string) {
  const handlers = new Map<string, Handler>();
  const statuses: Array<string | undefined> = [];
  const ctx = {
    cwd,
    hasUI: true,
    isProjectTrusted: () => false,
    sessionManager: {
      getSessionId: () => "dependency-policy-test-session",
      getSessionFile: () => undefined,
    },
    ui: {
      setStatus(_key: string, text: string | undefined) {
        statuses.push(text);
      },
      notify() {},
    },
  };

  sandboxRuntimeExtension({
    registerEntryRenderer() {},
    appendEntry() {},
    registerFlag() {},
    getFlag() {
      return false;
    },
    registerTool() {},
    on(name: string, handler: Handler) {
      handlers.set(name, handler);
    },
    registerCommand() {},
    getActiveTools() {
      return [];
    },
    getAllTools() {
      return [];
    },
  } as any);

  return { ctx, handlers, statuses };
}

test("startup initializes each session with its current dependency overrides", { concurrency: false }, async () => {
  const agentDir = await mkdtemp(path.join(tmpdir(), "pi-sandbox-dependency-policy-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const originals = {
    checkDependenciesAsync: SandboxManager.checkDependenciesAsync,
    cleanupAfterCommand: SandboxManager.cleanupAfterCommand,
    initialize: SandboxManager.initialize,
    isSupportedPlatform: SandboxManager.isSupportedPlatform,
    reset: SandboxManager.reset,
    wrapWithSandboxArgv: SandboxManager.wrapWithSandboxArgv,
  };
  const initializeCalls: any[][] = [];
  let unexpectedDependencyChecks = 0;
  let sessionRunning = false;

  process.env.PI_CODING_AGENT_DIR = agentDir;
  SandboxManager.isSupportedPlatform = () => true;
  SandboxManager.checkDependenciesAsync = async () => {
    unexpectedDependencyChecks++;
    throw new Error("unexpected extension-level dependency check");
  };
  SandboxManager.initialize = async (...args) => {
    initializeCalls.push(args);
  };
  SandboxManager.wrapWithSandboxArgv = async (command: string) => ({
    argv: ["/bin/sh", "-c", command],
    env: {},
  });
  SandboxManager.cleanupAfterCommand = () => {};
  SandboxManager.reset = async () => {};

  const firstBwrapPath = "/opt/pi-sandbox/first-bwrap";
  const secondBwrapPath = "/opt/pi-sandbox/second-bwrap";
  const writePolicy = (bwrapPath: string) => writeFile(
    path.join(agentDir, "sandbox.json"),
    JSON.stringify({ enabled: true, bwrapPath }),
  );
  const harness = createHarness(agentDir);
  const start = () => harness.handlers.get("session_start")!({}, harness.ctx);
  const shutdown = () => harness.handlers.get("session_shutdown")!({}, harness.ctx);

  try {
    await writePolicy(firstBwrapPath);
    await start();
    sessionRunning = true;
    assert.equal(harness.statuses.at(-1), "sandboxed");
    assert.equal(initializeCalls.length, 1);
    assert.equal(initializeCalls[0]![0].bwrapPath, firstBwrapPath);
    assert.equal(initializeCalls[0]![1], undefined);
    assert.equal(initializeCalls[0]![2], true);

    await writePolicy(secondBwrapPath);
    await shutdown();
    sessionRunning = false;
    await start();
    sessionRunning = true;

    assert.equal(harness.statuses.at(-1), "sandboxed");
    assert.equal(initializeCalls.length, 2);
    assert.equal(initializeCalls[1]![0].bwrapPath, secondBwrapPath);
    assert.equal(initializeCalls[1]![1], undefined);
    assert.equal(initializeCalls[1]![2], true);
    assert.equal(unexpectedDependencyChecks, 0);
  } finally {
    if (sessionRunning) await shutdown();
    Object.assign(SandboxManager, originals);
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    await rm(agentDir, { recursive: true, force: true });
  }
});
