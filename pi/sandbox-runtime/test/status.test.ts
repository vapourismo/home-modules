import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import sandboxRuntimeExtension from "../index.ts";

type Handler = (...args: any[]) => any;

function createHarness(cwd: string, noSandbox = false) {
  const handlers = new Map<string, Handler>();
  const commands = new Map<string, any>();
  const statuses: Array<{ key: string; text: string | undefined }> = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const ctx = {
    cwd,
    hasUI: true,
    isProjectTrusted: () => false,
    ui: {
      setStatus(key: string, text: string | undefined) {
        statuses.push({ key, text });
      },
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
    },
  };

  sandboxRuntimeExtension({
    registerEntryRenderer() {},
    appendEntry() {},
    registerFlag() {},
    getFlag(name: string) {
      return name === "no-sandbox" ? noSandbox : undefined;
    },
    registerTool() {},
    on(name: string, handler: Handler) {
      handlers.set(name, handler);
    },
    registerCommand(name: string, command: any) {
      commands.set(name, command);
    },
    getActiveTools() {
      return [];
    },
    getAllTools() {
      return [];
    },
  } as any);

  return { commands, ctx, handlers, notifications, statuses };
}

async function start(harness: ReturnType<typeof createHarness>): Promise<void> {
  await harness.handlers.get("session_start")!({}, harness.ctx);
}

async function shutdown(harness: ReturnType<typeof createHarness>): Promise<void> {
  await harness.handlers.get("session_shutdown")!({}, harness.ctx);
}

async function sandboxCommand(harness: ReturnType<typeof createHarness>, args: string): Promise<string> {
  await harness.commands.get("sandbox").handler(args, harness.ctx);
  return harness.notifications.at(-1)!.message;
}

async function diagnostics(harness: ReturnType<typeof createHarness>): Promise<string> {
  return sandboxCommand(harness, "");
}

test("status line reports only whether sandboxing is active", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-status-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = root;

  const originals = {
    cleanupAfterCommand: SandboxManager.cleanupAfterCommand,
    initialize: SandboxManager.initialize,
    isSupportedPlatform: SandboxManager.isSupportedPlatform,
    reset: SandboxManager.reset,
    wrapWithSandboxArgv: SandboxManager.wrapWithSandboxArgv,
  };
  let dependencyErrors: string[] = [];
  SandboxManager.isSupportedPlatform = () => true;
  SandboxManager.initialize = async () => {
    if (dependencyErrors.length > 0) {
      throw new Error(`Sandbox dependencies not available: ${dependencyErrors.join(", ")}`);
    }
  };
  SandboxManager.wrapWithSandboxArgv = async (command: string) => ({
    argv: ["/bin/sh", "-c", command],
    env: {},
  });
  SandboxManager.cleanupAfterCommand = () => {};
  SandboxManager.reset = async () => {};

  t.after(async () => {
    Object.assign(SandboxManager, originals);
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    await rm(root, { recursive: true, force: true });
  });

  const flagDisabled = createHarness(root, true);
  await start(flagDisabled);
  assert.deepEqual(flagDisabled.statuses, [{ key: "anthropic-sandbox", text: "no sandbox" }]);
  assert.match(await diagnostics(flagDisabled), /Sandbox status: disabled\nReason: disabled by --no-sandbox\nViolation diagnostics: hidden \(toggle with \/sandbox violations\)/);
  await shutdown(flagDisabled);
  assert.equal(flagDisabled.statuses.at(-1)!.text, undefined);

  await writeFile(path.join(root, "sandbox.json"), JSON.stringify({ enabled: false }));
  const policyDisabled = createHarness(root);
  await start(policyDisabled);
  assert.deepEqual(policyDisabled.statuses, [{ key: "anthropic-sandbox", text: "no sandbox" }]);
  assert.match(await diagnostics(policyDisabled), /Sandbox status: disabled\nReason: disabled by sandbox\.json/);
  await shutdown(policyDisabled);

  await writeFile(path.join(root, "sandbox.json"), JSON.stringify({ enabled: true }));
  dependencyErrors = ["test dependency failure"];
  const unavailable = createHarness(root);
  await start(unavailable);
  assert.deepEqual(unavailable.statuses, [{ key: "anthropic-sandbox", text: "no sandbox" }]);
  assert.match(await diagnostics(unavailable), /Sandbox status: unavailable\nReason: Sandbox dependencies not available: test dependency failure/);
  assert.match(unavailable.notifications[0]!.message, /Covered tools will fail closed/);
  await shutdown(unavailable);

  dependencyErrors = [];
  const active = createHarness(root);
  try {
    await start(active);
    assert.deepEqual(active.statuses, [{ key: "anthropic-sandbox", text: "sandboxed" }]);
    const detail = await diagnostics(active);
    assert.match(detail, /Sandbox status: active/);
    assert.match(detail, /Violation diagnostics: hidden \(toggle with \/sandbox violations\)/);
    assert.match(detail, /Rules: 0 allowed domains, 0 denied domains/);

    assert.equal(await sandboxCommand(active, "violations"), "Sandbox violation diagnostics: shown");
    assert.match(await diagnostics(active), /Sandbox status: active[\s\S]*Violation diagnostics: shown/);

    assert.equal(await sandboxCommand(active, "violations on"), "Sandbox violation diagnostics: shown");
    assert.match(await diagnostics(active), /Sandbox status: active[\s\S]*Violation diagnostics: shown/);

    assert.equal(await sandboxCommand(active, "violations off"), "Sandbox violation diagnostics: hidden");
    assert.match(await diagnostics(active), /Sandbox status: active[\s\S]*Violation diagnostics: hidden/);

    assert.equal(await sandboxCommand(active, "violations toggle"), "Sandbox violation diagnostics: shown");
    for (const invalidArgs of ["status", "violations maybe", "violations on extra"]) {
      assert.equal(await sandboxCommand(active, invalidArgs), "Usage: /sandbox [violations [on|off|toggle]]");
      assert.equal(active.notifications.at(-1)!.level, "error");
      assert.match(await diagnostics(active), /Sandbox status: active[\s\S]*Violation diagnostics: shown/);
    }
  } finally {
    await shutdown(active);
  }
  assert.equal(active.statuses.at(-1)!.text, undefined);
});
