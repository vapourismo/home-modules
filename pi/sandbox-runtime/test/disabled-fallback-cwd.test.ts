import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { ExtensionContext, ToolDefinition } from "@earendil-works/pi-coding-agent";

type Handler = (...args: any[]) => any;
type ExtensionFactory = typeof import("../index.ts").default;

function createContext(
  cwd: string,
  sessionId: string,
  statuses: Array<string | undefined>,
  notifications: string[],
): ExtensionContext {
  return {
    cwd,
    hasUI: true,
    isProjectTrusted: () => true,
    sessionManager: {
      getSessionId: () => sessionId,
      getSessionFile: () => undefined,
    },
    ui: {
      setStatus(_key: string, text: string | undefined) {
        statuses.push(text);
      },
      notify(message: string) {
        notifications.push(message);
      },
    },
  } as any;
}

function createHarness(extension: ExtensionFactory, noSandbox: boolean) {
  const commands = new Map<string, any>();
  const handlers = new Map<string, Handler>();
  const notifications: string[] = [];
  const statuses: Array<string | undefined> = [];
  const tools = new Map<string, ToolDefinition<any, any>>();

  extension({
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

  return { commands, handlers, notifications, statuses, tools };
}

async function execute(
  tools: Map<string, ToolDefinition<any, any>>,
  name: string,
  params: any,
  ctx: ExtensionContext,
): Promise<any> {
  const definition = tools.get(name);
  assert.ok(definition, `${name} should be registered`);
  return definition.execute(`${name}-test`, params, undefined, undefined, ctx);
}

function textResult(result: any): string {
  return result.content
    .filter((entry: any) => entry.type === "text")
    .map((entry: any) => entry.text)
    .join("\n");
}

async function assertLaunchPolicyDisabled(
  harness: ReturnType<typeof createHarness>,
  ctx: ExtensionContext,
  launchCwd: string,
  sessionCwds: string[],
): Promise<void> {
  assert.equal(harness.statuses.at(-1), "no sandbox");
  assert.deepEqual(harness.notifications, []);

  await harness.commands.get("sandbox").handler("", ctx);
  const diagnostics = harness.notifications.at(-1)!;
  assert.match(diagnostics, /^Sandbox status: disabled$/m);
  assert.match(diagnostics, /^Reason: disabled by sandbox\.json \(enabled: false\)$/m);
  assert.ok(
    diagnostics.includes(
      `project: ${path.join(launchCwd, ".pi", "sandbox.json")} (loaded)`,
    ),
  );
  for (const sessionCwd of sessionCwds) {
    assert.ok(!diagnostics.includes(path.join(sessionCwd, ".pi", "sandbox.json")));
  }
  harness.notifications.length = 0;
}

async function writeShellWrapper(filePath: string, marker: string): Promise<void> {
  await writeFile(filePath, `#!/bin/sh
printf '%s\\n' '${marker}'
exec /bin/bash "$@"
`);
  await chmod(filePath, 0o755);
}

async function writeSearchFixtures(binDir: string): Promise<void> {
  const fdPath = path.join(binDir, "fd");
  const rgPath = path.join(binDir, "rg");
  await writeFile(fdPath, `#!${process.execPath}
const fs = require("node:fs");
if (process.argv[2] === "--version") {
  process.stdout.write("fd fixture\\n");
  process.exit(0);
}
const args = process.argv.slice(2);
fs.writeFileSync(process.env.PI_TEST_FD_LOG, JSON.stringify(args));
process.stdout.write(args.at(-1) + "/fixture-find.txt\\n");
`);
  await writeFile(rgPath, `#!${process.execPath}
const fs = require("node:fs");
if (process.argv[2] === "--version") {
  process.stdout.write("rg fixture\\n");
  process.exit(0);
}
const args = process.argv.slice(2);
const root = args.at(-1);
fs.writeFileSync(process.env.PI_TEST_RG_LOG, JSON.stringify(args));
process.stdout.write(JSON.stringify({
  type: "match",
  data: {
    path: { text: root + "/fixture-grep.txt" },
    line_number: 1,
    lines: { text: "resumed needle\\n" },
  },
}) + "\\n");
`);
  await Promise.all([chmod(fdPath, 0o755), chmod(rgPath, 0o755)]);
}

async function seedDirectories(launchCwd: string, firstCwd: string, resumedCwd: string): Promise<void> {
  await Promise.all([
    writeFile(path.join(launchCwd, "read-target.txt"), "launch read\n"),
    writeFile(path.join(firstCwd, "read-target.txt"), "first read\n"),
    writeFile(path.join(resumedCwd, "read-target.txt"), "resumed read\n"),
    writeFile(path.join(launchCwd, "write-target.txt"), "launch write\n"),
    writeFile(path.join(firstCwd, "write-target.txt"), "first write\n"),
    writeFile(path.join(resumedCwd, "write-target.txt"), "resumed write before\n"),
    writeFile(path.join(launchCwd, "edit-target.txt"), "before edit\n"),
    writeFile(path.join(firstCwd, "edit-target.txt"), "before edit\n"),
    writeFile(path.join(resumedCwd, "edit-target.txt"), "before edit\n"),
    writeFile(path.join(launchCwd, "launch-only.txt"), "launch\n"),
    writeFile(path.join(firstCwd, "first-only.txt"), "first\n"),
    writeFile(path.join(resumedCwd, "resumed-only.txt"), "resumed\n"),
    writeFile(path.join(resumedCwd, "fixture-grep.txt"), "resumed needle\n"),
  ]);
}

async function runSessionSwitchScenario(
  extension: ExtensionFactory,
  root: string,
  name: string,
  noSandbox: boolean,
): Promise<void> {
  const scenarioRoot = path.join(root, name);
  const launchCwd = path.join(scenarioRoot, "launch");
  const firstCwd = path.join(scenarioRoot, "first-session");
  const resumedCwd = path.join(scenarioRoot, "resumed-session");
  await Promise.all([
    mkdir(path.join(launchCwd, ".pi"), { recursive: true }),
    mkdir(path.join(firstCwd, ".pi"), { recursive: true }),
    mkdir(path.join(resumedCwd, ".pi"), { recursive: true }),
  ]);
  await seedDirectories(launchCwd, firstCwd, resumedCwd);

  const launchShell = path.join(scenarioRoot, "launch-shell");
  const firstShell = path.join(scenarioRoot, "first-shell");
  const resumedShell = path.join(scenarioRoot, "resumed-shell");
  await Promise.all([
    writeShellWrapper(launchShell, "launch-shell-marker"),
    writeShellWrapper(firstShell, "first-shell-marker"),
    writeShellWrapper(resumedShell, "resumed-shell-marker"),
    writeFile(
      path.join(launchCwd, ".pi", "settings.json"),
      JSON.stringify({
        shellPath: launchShell,
        shellCommandPrefix: "printf 'launch-prefix-marker\\n'",
      }),
    ),
    writeFile(
      path.join(firstCwd, ".pi", "settings.json"),
      JSON.stringify({
        shellPath: firstShell,
        shellCommandPrefix: "printf 'first-prefix-marker\\n'",
      }),
    ),
    writeFile(
      path.join(resumedCwd, ".pi", "settings.json"),
      JSON.stringify({
        shellPath: resumedShell,
        shellCommandPrefix: "printf 'resumed-prefix-marker\\n'",
      }),
    ),
  ]);
  if (!noSandbox) {
    await Promise.all([
      writeFile(
        path.join(launchCwd, ".pi", "sandbox.json"),
        JSON.stringify({ enabled: false }),
      ),
      writeFile(path.join(firstCwd, ".pi", "sandbox.json"), "{ malformed"),
      writeFile(
        path.join(resumedCwd, ".pi", "sandbox.json"),
        JSON.stringify({ enabled: true }),
      ),
    ]);
  }

  process.chdir(launchCwd);
  const processWorkingDirectory = process.cwd();
  const sessionWorkingDirectories = await Promise.all([
    realpath(firstCwd),
    realpath(resumedCwd),
  ]);
  const harness = createHarness(extension, noSandbox);
  const firstContext = createContext(
    firstCwd,
    `${name}-first`,
    harness.statuses,
    harness.notifications,
  );
  const resumedContext = createContext(
    resumedCwd,
    `${name}-resumed`,
    harness.statuses,
    harness.notifications,
  );

  await harness.handlers.get("session_start")!({ type: "session_start", reason: "startup" }, firstContext);
  if (!noSandbox) {
    await assertLaunchPolicyDisabled(
      harness,
      firstContext,
      processWorkingDirectory,
      sessionWorkingDirectories,
    );
  }
  const firstBashResult = await execute(
    harness.tools,
    "bash",
    { command: "printf 'first-command-marker\\n'; pwd -P" },
    firstContext,
  );
  assert.equal(
    textResult(firstBashResult),
    `first-shell-marker\nfirst-prefix-marker\nfirst-command-marker\n${sessionWorkingDirectories[0]}\n`,
  );
  assert.doesNotMatch(textResult(firstBashResult), /launch-|resumed-/);

  await harness.handlers.get("session_shutdown")!({ type: "session_shutdown" }, firstContext);
  await harness.handlers.get("session_start")!({ type: "session_start", reason: "resume" }, resumedContext);

  try {
    if (!noSandbox) {
      await assertLaunchPolicyDisabled(
        harness,
        resumedContext,
        processWorkingDirectory,
        sessionWorkingDirectories,
      );
    }
    const readResult = await execute(harness.tools, "read", { path: "read-target.txt" }, resumedContext);
    assert.equal(textResult(readResult), "resumed read\n");

    await execute(
      harness.tools,
      "write",
      { path: "write-target.txt", content: "written in resumed\n" },
      resumedContext,
    );
    assert.equal(await readFile(path.join(resumedCwd, "write-target.txt"), "utf8"), "written in resumed\n");
    assert.equal(await readFile(path.join(firstCwd, "write-target.txt"), "utf8"), "first write\n");
    assert.equal(await readFile(path.join(launchCwd, "write-target.txt"), "utf8"), "launch write\n");

    await execute(harness.tools, "edit", {
      path: "edit-target.txt",
      edits: [{ oldText: "before edit", newText: "edited in resumed" }],
    }, resumedContext);
    assert.equal(await readFile(path.join(resumedCwd, "edit-target.txt"), "utf8"), "edited in resumed\n");
    assert.equal(await readFile(path.join(firstCwd, "edit-target.txt"), "utf8"), "before edit\n");
    assert.equal(await readFile(path.join(launchCwd, "edit-target.txt"), "utf8"), "before edit\n");

    const lsResult = await execute(harness.tools, "ls", { path: "." }, resumedContext);
    assert.match(textResult(lsResult), /^resumed-only\.txt$/m);
    assert.doesNotMatch(textResult(lsResult), /^(?:launch|first)-only\.txt$/m);

    const fdLog = path.join(scenarioRoot, "fd-args.json");
    process.env.PI_TEST_FD_LOG = fdLog;
    const findResult = await execute(harness.tools, "find", { pattern: "*.txt" }, resumedContext);
    assert.match(textResult(findResult), /^fixture-find\.txt$/m);
    const fdArgs = JSON.parse(await readFile(fdLog, "utf8"));
    assert.equal(fdArgs.at(-1), resumedCwd);

    const rgLog = path.join(scenarioRoot, "rg-args.json");
    process.env.PI_TEST_RG_LOG = rgLog;
    const grepResult = await execute(harness.tools, "grep", { pattern: "needle" }, resumedContext);
    assert.match(textResult(grepResult), /^fixture-grep\.txt:1: resumed needle$/m);
    const rgArgs = JSON.parse(await readFile(rgLog, "utf8"));
    assert.equal(rgArgs.at(-1), resumedCwd);

    const bashResult = await execute(
      harness.tools,
      "bash",
      { command: "printf 'resumed-command-marker\\n'; pwd -P" },
      resumedContext,
    );
    assert.equal(
      textResult(bashResult),
      `resumed-shell-marker\nresumed-prefix-marker\nresumed-command-marker\n${sessionWorkingDirectories[1]}\n`,
    );
    assert.doesNotMatch(textResult(bashResult), /launch-|first-/);
  } finally {
    await harness.handlers.get("session_shutdown")!({ type: "session_shutdown" }, resumedContext);
  }
}

test("disabled fallback tools follow the resumed session cwd", { concurrency: false }, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-disabled-fallback-cwd-"));
  const originalCwd = process.cwd();
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const originalFdLog = process.env.PI_TEST_FD_LOG;
  const originalRgLog = process.env.PI_TEST_RG_LOG;

  t.after(async () => {
    process.chdir(originalCwd);
    if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    if (originalFdLog === undefined) delete process.env.PI_TEST_FD_LOG;
    else process.env.PI_TEST_FD_LOG = originalFdLog;
    if (originalRgLog === undefined) delete process.env.PI_TEST_RG_LOG;
    else process.env.PI_TEST_RG_LOG = originalRgLog;
    await rm(root, { recursive: true, force: true });
  });

  const agentDir = path.join(root, "agent");
  const binDir = path.join(agentDir, "bin");
  await mkdir(binDir, { recursive: true });
  await writeSearchFixtures(binDir);
  process.env.PI_CODING_AGENT_DIR = agentDir;

  const { default: extension } = await import("../index.ts");
  await t.test("--no-sandbox", () => runSessionSwitchScenario(extension, root, "flag-disabled", true));
  await t.test("launch-directory sandbox.json enabled false", () => runSessionSwitchScenario(extension, root, "policy-disabled", false));
});
