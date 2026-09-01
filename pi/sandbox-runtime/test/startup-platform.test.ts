import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import sandboxRuntimeExtension from "../index.ts";
import { PLATFORM_SUPPORT_MESSAGE } from "../src/platform.ts";

type Handler = (...args: any[]) => any;

function createHarness(cwd: string, noSandbox: boolean) {
  const commands = new Map<string, any>();
  const handlers = new Map<string, Handler>();
  const tools = new Map<string, ToolDefinition<any, any>>();
  const notifications: Array<{ message: string; level: string }> = [];
  const statuses: Array<{ key: string; text: string | undefined }> = [];
  const ctx = {
    cwd,
    hasUI: true,
    isProjectTrusted: () => true,
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
    registerTool(definition: ToolDefinition<any, any>) {
      tools.set(definition.name, definition);
    },
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

  return { commands, ctx, handlers, notifications, statuses, tools };
}

async function assertLinuxFailsClosed(
  t: TestContext,
  root: string,
  noSandbox: boolean,
  runtimeCalls: Record<string, number>,
): Promise<void> {
  await t.test(noSandbox ? "with --no-sandbox" : "with sandboxing requested", async () => {
    const harness = createHarness(root, noSandbox);
    await harness.handlers.get("session_start")!({}, harness.ctx);

    const reason = `${PLATFORM_SUPPORT_MESSAGE} (detected linux)`;
    assert.deepEqual(harness.statuses, [{ key: "anthropic-sandbox", text: "no sandbox" }]);
    assert.deepEqual(harness.notifications, [{
      message: `Sandbox unavailable: ${reason}. Covered tools will fail closed.`,
      level: "error",
    }]);

    await harness.commands.get("sandbox").handler("", harness.ctx);
    const diagnostics = harness.notifications.at(-1)!;
    assert.equal(diagnostics.level, "error");
    assert.ok(diagnostics.message.startsWith(`Sandbox status: unavailable\nReason: ${reason}\n`));
    assert.match(diagnostics.message, /Policy sources:\n  \(not loaded\)/);

    assert.deepEqual(
      [...harness.tools.keys()].sort(),
      ["bash", "edit", "find", "grep", "ls", "read", "unsandboxed_bash", "write"],
    );
    const coveredToolNames = ["read", "bash", "edit", "write", "grep", "find", "ls"];
    for (const name of coveredToolNames) {
      const definition = harness.tools.get(name)!;
      await assert.rejects(
        definition.execute(`${name}-linux-test`, {}, undefined, undefined, harness.ctx as any),
        (error: unknown) => error instanceof Error
          && error.message === `Sandbox unavailable: ${reason}. Sandboxing is enabled; refusing unsandboxed ${name} execution.`,
      );
    }
    assert.equal(harness.tools.get("unsandboxed_bash")!.label, "bash (unsandboxed)");

    assert.deepEqual(runtimeCalls, {
      checkDependenciesAsync: 0,
      initialize: 0,
      isSupportedPlatform: 0,
      wrapWithSandboxArgv: 0,
    });

    await harness.handlers.get("session_shutdown")!({}, harness.ctx);
    assert.equal(harness.statuses.at(-1)!.text, undefined);
  });
}

test("Linux startup fails closed before policy, disable flag, dependencies, or helper launch", { concurrency: false }, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-linux-startup-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
  assert.ok(platformDescriptor);
  const originals = {
    checkDependenciesAsync: SandboxManager.checkDependenciesAsync,
    initialize: SandboxManager.initialize,
    isSupportedPlatform: SandboxManager.isSupportedPlatform,
    wrapWithSandboxArgv: SandboxManager.wrapWithSandboxArgv,
  };
  const runtimeCalls = {
    checkDependenciesAsync: 0,
    initialize: 0,
    isSupportedPlatform: 0,
    wrapWithSandboxArgv: 0,
  };

  process.env.PI_CODING_AGENT_DIR = root;
  Object.defineProperty(process, "platform", { ...platformDescriptor, value: "linux" });
  await writeFile(path.join(root, "sandbox.json"), "{ this policy must not be loaded");

  SandboxManager.checkDependenciesAsync = async () => {
    runtimeCalls.checkDependenciesAsync++;
    throw new Error("unexpected dependency check");
  };
  SandboxManager.initialize = async () => {
    runtimeCalls.initialize++;
    throw new Error("unexpected initialization");
  };
  SandboxManager.isSupportedPlatform = () => {
    runtimeCalls.isSupportedPlatform++;
    return true;
  };
  SandboxManager.wrapWithSandboxArgv = async () => {
    runtimeCalls.wrapWithSandboxArgv++;
    throw new Error("unexpected helper launch");
  };

  t.after(async () => {
    Object.assign(SandboxManager, originals);
    Object.defineProperty(process, "platform", platformDescriptor);
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    await rm(root, { recursive: true, force: true });
  });

  await assertLinuxFailsClosed(t, root, false, runtimeCalls);
  await assertLinuxFailsClosed(t, root, true, runtimeCalls);
});
