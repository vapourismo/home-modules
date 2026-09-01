import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { EOL, tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  SandboxManager,
  type SandboxViolationEvent,
} from "@anthropic-ai/sandbox-runtime";
import type { ExtensionContext, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import sandboxRuntimeExtension from "../index.ts";

type Handler = (...args: any[]) => any;
type EntryRenderer = (...args: any[]) => any;

interface AppendedEntry {
  customType: string;
  data: {
    diagnostic: string;
    source: string;
  };
}

function createHarness() {
  const commands = new Map<string, any>();
  const handlers = new Map<string, Handler>();
  const tools = new Map<string, ToolDefinition<any, any>>();
  const renderers = new Map<string, EntryRenderer>();
  const entries: AppendedEntry[] = [];
  const notifications: Array<{ message: string; level: string }> = [];
  const statuses: Array<{ key: string; text: string | undefined }> = [];
  const ctx = {
    cwd: process.cwd(),
    hasUI: true,
    isProjectTrusted: () => false,
    sessionManager: {
      getSessionId: () => "diagnostics-test-session",
      getSessionFile: () => undefined,
    },
    ui: {
      setStatus(key: string, text: string | undefined) {
        statuses.push({ key, text });
      },
      notify(message: string, level: string) {
        notifications.push({ message, level });
      },
    },
  } as any as ExtensionContext;

  sandboxRuntimeExtension({
    registerEntryRenderer(customType: string, renderer: EntryRenderer) {
      renderers.set(customType, renderer);
    },
    appendEntry(customType: string, data: AppendedEntry["data"]) {
      entries.push({ customType, data });
    },
    registerFlag() {},
    getFlag() {
      return false;
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

  return { commands, ctx, entries, handlers, notifications, renderers, statuses, tools };
}

function textResult(result: any): string {
  return result.content
    .filter((entry: any) => entry.type === "text")
    .map((entry: any) => entry.text)
    .join("\n");
}

function renderEntry(renderer: EntryRenderer, entry: AppendedEntry): string {
  const theme = {
    bg(_color: string, text: string) {
      return text;
    },
    bold(text: string) {
      return text;
    },
    fg(_color: string, text: string) {
      return text;
    },
  };
  return renderer({ type: "custom", data: entry.data }, { expanded: false }, theme)
    .render(160)
    .join("\n");
}

const FIRST_THEME_MARKERS = {
  warning: "\x1b[31m",
  customMessageText: "\x1b[32m",
  customMessageBg: "\x1b[41m",
};
const SECOND_THEME_MARKERS = {
  warning: "\x1b[35m",
  customMessageText: "\x1b[36m",
  customMessageBg: "\x1b[44m",
};

type ThemeMarkers = typeof FIRST_THEME_MARKERS;

function createMutableTheme(initialMarkers: ThemeMarkers) {
  let markers = initialMarkers;
  return {
    theme: {
      bg(color: keyof ThemeMarkers, text: string) {
        return `${markers[color]}${text}\x1b[49m`;
      },
      bold(text: string) {
        return `\x1b[1m${text}\x1b[22m`;
      },
      fg(color: keyof ThemeMarkers, text: string) {
        return `${markers[color]}${text}\x1b[39m`;
      },
    },
    use(nextMarkers: ThemeMarkers) {
      markers = nextMarkers;
    },
  };
}

function countOccurrences(text: string, value: string): number {
  return text.split(value).length - 1;
}

async function configureAgentDir(t: TestContext): Promise<string> {
  const agentDir = await mkdtemp(path.join(tmpdir(), "pi-sandbox-diagnostics-agent-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  await writeFile(path.join(agentDir, "sandbox.json"), JSON.stringify({ enabled: true }));
  t.after(async () => {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    await rm(agentDir, { recursive: true, force: true });
  });
  return agentDir;
}

interface ObservableExtensionViolationStore {
  getViolationsForCommand(commandId: string): SandboxViolationEvent[];
  subscribe(listener: (violations: SandboxViolationEvent[]) => void): () => void;
}

class ExtensionViolationStore implements ObservableExtensionViolationStore {
  readonly violationsByCommand = new Map<string, SandboxViolationEvent[]>();
  readonly listeners = new Set<(violations: SandboxViolationEvent[]) => void>();
  unsubscribeCount = 0;

  getViolationsForCommand(commandId: string): SandboxViolationEvent[] {
    return [...(this.violationsByCommand.get(commandId) ?? [])];
  }

  addBatch(commandId: string, violations: SandboxViolationEvent[]): void {
    const current = this.violationsByCommand.get(commandId) ?? [];
    current.push(...violations);
    this.violationsByCommand.set(commandId, current);
    this.notify();
  }

  notify(): void {
    const snapshot = [...this.violationsByCommand.values()].flat();
    for (const listener of this.listeners) listener(snapshot);
  }

  subscribe(listener: (violations: SandboxViolationEvent[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.violationsByCommand.values()].flat());
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.listeners.delete(listener);
      this.unsubscribeCount++;
    };
  }
}

function installManagerMocks(
  t: TestContext,
  options: {
    getViolations?(commandId: string): any[];
    store?: ObservableExtensionViolationStore;
    wrap(
      command: string,
      metadata?: { commandId?: string; commandText?: string },
      shellPath?: string,
      cwd?: string,
    ): { argv: string[]; env: NodeJS.ProcessEnv };
  },
): void {
  const originals = {
    cleanupAfterCommand: SandboxManager.cleanupAfterCommand,
    getSandboxViolationStore: SandboxManager.getSandboxViolationStore,
    initialize: SandboxManager.initialize,
    isSupportedPlatform: SandboxManager.isSupportedPlatform,
    reset: SandboxManager.reset,
    wrapWithSandboxArgv: SandboxManager.wrapWithSandboxArgv,
  };

  SandboxManager.isSupportedPlatform = () => true;
  SandboxManager.initialize = async () => {};
  SandboxManager.cleanupAfterCommand = () => {};
  SandboxManager.reset = async () => {};
  SandboxManager.getSandboxViolationStore = () => (options.store ?? {
    getViolationsForCommand: options.getViolations ?? (() => []),
    subscribe() {
      return () => {};
    },
  }) as any;
  SandboxManager.wrapWithSandboxArgv = async (
    command: string,
    binShell: unknown,
    _customConfig: unknown,
    _signal: unknown,
    cwd: unknown,
    metadata: { commandId?: string; commandText?: string } | undefined,
  ) => options.wrap(
    command,
    metadata,
    typeof binShell === "string" ? binShell : undefined,
    typeof cwd === "string" ? cwd : undefined,
  ) as any;

  t.after(() => {
    Object.assign(SandboxManager, originals);
  });
}

function fakeFilesystemHelperArgv(): string[] {
  const script = String.raw`
let buffered = "";
process.stdin.setEncoding("utf8");
function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}
function handle(message) {
  if (!message || message.id === undefined || typeof message.method !== "string") return;
  if (message.method === "probe") {
    send({ id: message.id, result: { ok: true } });
    return;
  }
  if (message.method === "ls") {
    const requestedPath = String(message.params?.path ?? "");
    if (requestedPath.endsWith("denied")) {
      send({ id: message.id, error: { message: "filesystem access denied exactly", code: "EACCES" } });
      return;
    }
    if (requestedPath.endsWith("crash")) {
      process.exit(23);
    }
    const delay = requestedPath.includes("slow-") ? 30 : 0;
    setTimeout(() => send({
      id: message.id,
      result: { entries: [], limitReached: false, limit: message.params?.limit ?? 500 },
    }), delay);
    return;
  }
  send({ id: message.id, error: { message: "unsupported fake method" } });
}
process.stdin.on("data", (chunk) => {
  buffered += chunk;
  while (true) {
    const newline = buffered.indexOf("\n");
    if (newline < 0) break;
    const line = buffered.slice(0, newline);
    buffered = buffered.slice(newline + 1);
    if (line.trim()) handle(JSON.parse(line));
  }
});
`;
  return [process.execPath, "-e", script];
}

function helperViolation(
  line: string,
  sequence: number,
  overrides: Partial<SandboxViolationEvent> = {},
): SandboxViolationEvent {
  return {
    line,
    command: "pi sandbox filesystem helper",
    encodedCommand: "captured-helper-command",
    timestamp: new Date(sequence),
    ...overrides,
  };
}

async function nextTurn(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function waitForEntryCount(entries: AppendedEntry[], count: number): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (entries.length < count && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(entries.length, count);
}

test("violation renderer rebuilds persistent themed content on invalidation", async () => {
  const harness = createHarness();
  const renderer = [...harness.renderers.values()][0];
  assert.ok(renderer);
  const entry: AppendedEntry = {
    customType: "anthropic-sandbox-violation",
    data: {
      source: "persistent renderer source",
      diagnostic: "persistent renderer diagnostic",
    },
  };
  const mutableTheme = createMutableTheme(FIRST_THEME_MARKERS);

  await harness.commands.get("sandbox").handler("violations on", harness.ctx);
  const component = renderer(
    { type: "custom", data: entry.data },
    { expanded: false },
    mutableTheme.theme,
  );
  const firstRender = component.render(160).join("\n");
  for (const marker of Object.values(FIRST_THEME_MARKERS)) {
    assert.ok(firstRender.includes(marker));
  }

  mutableTheme.use(SECOND_THEME_MARKERS);
  component.invalidate();
  component.invalidate();
  component.invalidate();
  const secondRender = component.render(160).join("\n");
  for (const marker of Object.values(FIRST_THEME_MARKERS)) {
    assert.ok(!secondRender.includes(marker), `old theme marker ${JSON.stringify(marker)} should be absent`);
  }
  for (const marker of Object.values(SECOND_THEME_MARKERS)) {
    assert.ok(secondRender.includes(marker), `new theme marker ${JSON.stringify(marker)} should be present`);
  }
  assert.equal(countOccurrences(secondRender, entry.data.source), 1);
  assert.equal(countOccurrences(secondRender, entry.data.diagnostic), 1);

  const constrainedWidth = 24;
  const constrainedLines = component.render(constrainedWidth);
  assert.ok(constrainedLines.length > 0);
  for (const line of constrainedLines) {
    assert.ok(visibleWidth(line) <= constrainedWidth);
  }
});

test("hidden violation renderer rebuilds before it is revealed", async () => {
  const harness = createHarness();
  const renderer = [...harness.renderers.values()][0];
  assert.ok(renderer);
  const entry: AppendedEntry = {
    customType: "anthropic-sandbox-violation",
    data: {
      source: "hidden renderer source",
      diagnostic: "hidden renderer diagnostic",
    },
  };
  const mutableTheme = createMutableTheme(FIRST_THEME_MARKERS);
  const component = renderer(
    { type: "custom", data: entry.data },
    { expanded: false },
    mutableTheme.theme,
  );

  assert.deepEqual(component.render(80), []);
  mutableTheme.use(SECOND_THEME_MARKERS);
  component.invalidate();
  component.invalidate();
  assert.deepEqual(component.render(80), []);

  await harness.commands.get("sandbox").handler("violations on", harness.ctx);
  const revealed = component.render(80).join("\n");
  for (const marker of Object.values(FIRST_THEME_MARKERS)) {
    assert.ok(!revealed.includes(marker), `old theme marker ${JSON.stringify(marker)} should be absent`);
  }
  for (const marker of Object.values(SECOND_THEME_MARKERS)) {
    assert.ok(revealed.includes(marker), `new theme marker ${JSON.stringify(marker)} should be present`);
  }
  assert.equal(countOccurrences(revealed, entry.data.source), 1);
  assert.equal(countOccurrences(revealed, entry.data.diagnostic), 1);
});

test("sandboxed Bash uses the configured shell and applies the prefix once", { concurrency: false }, async (t) => {
  const agentDir = await configureAgentDir(t);
  const shellPath = path.join(agentDir, "configured-shell");
  await writeFile(shellPath, `#!/bin/sh
printf 'sandboxed-shell-marker\\n'
exec /bin/bash "$@"
`);
  await chmod(shellPath, 0o755);
  await writeFile(
    path.join(agentDir, "settings.json"),
    JSON.stringify({
      shellPath,
      shellCommandPrefix: "printf 'sandboxed-prefix-marker\\n'",
    }),
  );

  const wrappedCalls: Array<{
    command: string;
    commandId: string | undefined;
    shellPath: string | undefined;
    cwd: string | undefined;
  }> = [];
  installManagerMocks(t, {
    wrap(command, metadata, wrappedShellPath, cwd) {
      wrappedCalls.push({
        command,
        commandId: metadata?.commandId,
        shellPath: wrappedShellPath,
        cwd,
      });
      return metadata?.commandId?.startsWith("pi-sandbox-helper:")
        ? { argv: fakeFilesystemHelperArgv(), env: process.env }
        : {
            argv: [wrappedShellPath ?? "/bin/sh", "-c", command],
            env: process.env,
          };
    },
  });

  const harness = createHarness();
  await harness.handlers.get("session_start")!({}, harness.ctx);

  try {
    const result = await harness.tools.get("bash")!.execute(
      "configured-sandboxed-bash",
      { command: "printf 'sandboxed-command-marker\\n'" },
      undefined,
      undefined,
      harness.ctx,
    );
    assert.equal(
      textResult(result),
      "sandboxed-shell-marker\nsandboxed-prefix-marker\nsandboxed-command-marker\n",
    );

    const helperCall = wrappedCalls.find((call) =>
      call.commandId?.startsWith("pi-sandbox-helper:"),
    );
    assert.ok(helperCall);
    assert.equal(helperCall.shellPath, undefined);
    assert.equal(helperCall.cwd, harness.ctx.cwd);

    const agentCall = wrappedCalls.find((call) =>
      call.commandId?.startsWith("pi-bash-tool:"),
    );
    assert.ok(agentCall);
    assert.equal(agentCall.shellPath, shellPath);
    assert.equal(agentCall.cwd, harness.ctx.cwd);
    assert.equal(
      countOccurrences(agentCall.command, "sandboxed-prefix-marker"),
      1,
    );

    // Pi's user-Bash pipeline applies the prefix before invoking intercepted
    // operations, so this backend must forward its input without adding it again.
    const intercepted = harness.handlers.get("user_bash")!({
      excludeFromContext: false,
    });
    let userOutput = "";
    await intercepted.operations.exec(
      "printf 'sandboxed-user-marker\\n'",
      harness.ctx.cwd,
      { onData: (chunk: Buffer) => { userOutput += chunk.toString("utf8"); } },
    );
    assert.equal(
      userOutput,
      "sandboxed-shell-marker\nsandboxed-user-marker\n",
    );
    const userCall = wrappedCalls.find((call) =>
      call.commandId?.startsWith("pi-user-bash:"),
    );
    assert.ok(userCall);
    assert.equal(userCall.shellPath, shellPath);
    assert.equal(userCall.cwd, harness.ctx.cwd);
    assert.doesNotMatch(userCall.command, /sandboxed-prefix-marker/);
  } finally {
    await harness.handlers.get("session_shutdown")!({}, harness.ctx);
  }
});

test("agent and user Bash diagnostics render as user-only entries without entering output", { concurrency: false }, async (t) => {
  await configureAgentDir(t);
  let violationsEnabled = true;
  const violationLine = "bash(123) deny(1) file-read-data /private/diagnostics-test";
  installManagerMocks(t, {
    getViolations(commandId) {
      if (!violationsEnabled || !/^(?:pi-bash-tool|pi-user-bash):/.test(commandId)) return [];
      return [{ line: violationLine, command: commandId, timestamp: new Date(0) }];
    },
    wrap(command) {
      return { argv: ["/bin/sh", "-c", command], env: process.env };
    },
  });

  const harness = createHarness();
  await harness.handlers.get("session_start")!({}, harness.ctx);

  try {
    assert.equal(harness.renderers.size, 1);
    assert.equal(harness.entries.length, 0, "a successful helper startup should not create a diagnostic");

    const updates: any[] = [];
    const bash = harness.tools.get("bash");
    assert.ok(bash);
    const agentResult = await bash.execute(
      "agent-call",
      { command: "printf 'agent output'" },
      undefined,
      (update) => updates.push(update),
      harness.ctx,
    );
    assert.equal(textResult(agentResult), "agent output");
    assert.doesNotMatch(JSON.stringify(updates), /sandbox_violations|diagnostics-test/);
    assert.doesNotMatch(JSON.stringify(agentResult), /sandbox_violations|diagnostics-test/);
    assert.equal(harness.entries.length, 1);
    assert.equal(harness.entries[0]!.data.source, "agent Bash");
    assert.match(harness.entries[0]!.data.diagnostic, /<sandbox_violations>/);
    assert.ok(harness.entries[0]!.data.diagnostic.includes(violationLine));

    const renderer = harness.renderers.get(harness.entries[0]!.customType);
    assert.ok(renderer);
    assert.equal(renderEntry(renderer, harness.entries[0]!), "", "diagnostics should be hidden by default");

    const resultBeforeToggle = JSON.stringify(agentResult);
    const updatesBeforeToggle = JSON.stringify(updates);
    await harness.commands.get("sandbox").handler("violations on", harness.ctx);
    const rendered = renderEntry(renderer, harness.entries[0]!);
    assert.match(rendered, /⚠ Sandbox violation — agent Bash/);
    assert.match(rendered, /<sandbox_violations>/);
    assert.match(rendered, /diagnostics-test/);
    assert.equal(JSON.stringify(agentResult), resultBeforeToggle);
    assert.equal(JSON.stringify(updates), updatesBeforeToggle);

    await harness.commands.get("sandbox").handler("violations off", harness.ctx);
    assert.equal(renderEntry(renderer, harness.entries[0]!), "");

    violationsEnabled = false;
    await bash.execute(
      "clean-agent-call",
      { command: "printf 'clean output'" },
      undefined,
      undefined,
      harness.ctx,
    );
    assert.equal(harness.entries.length, 1, "agent commands without violations should not append entries");

    const userBash = harness.handlers.get("user_bash");
    assert.ok(userBash);
    const cleanUserBash = userBash({ excludeFromContext: false });
    await cleanUserBash.operations.exec("printf 'clean user output'", process.cwd(), { onData() {} });
    assert.equal(harness.entries.length, 1, "user commands without violations should not append entries");

    violationsEnabled = true;
    for (const excludeFromContext of [false, true]) {
      const intercepted = userBash({ excludeFromContext });
      let output = "";
      const result = await intercepted.operations.exec("printf 'user output'", process.cwd(), {
        onData(chunk: Buffer) {
          output += chunk.toString("utf8");
        },
      });
      assert.equal(result.exitCode, 0);
      assert.equal(output, "user output");
      assert.doesNotMatch(output, /sandbox_violations|diagnostics-test/);
    }

    assert.equal(harness.entries.length, 3);
    assert.deepEqual(harness.entries.slice(1).map((entry) => entry.data.source), ["user Bash", "user Bash"]);
    for (const entry of harness.entries) {
      assert.equal(renderEntry(renderer, entry), "", "agent and user diagnostics should append while hidden");
    }

    await harness.commands.get("sandbox").handler("violations on", harness.ctx);
    for (const entry of harness.entries) {
      assert.match(renderEntry(renderer, entry), /Sandbox violation/);
    }

    const subsequentResult = await bash.execute(
      "shown-agent-call",
      { command: "printf 'subsequent output'" },
      undefined,
      undefined,
      harness.ctx,
    );
    assert.equal(textResult(subsequentResult), "subsequent output");
    assert.doesNotMatch(JSON.stringify(subsequentResult), /sandbox_violations|diagnostics-test/);
    assert.equal(harness.entries.length, 4);
    assert.match(renderEntry(renderer, harness.entries[3]!), /Sandbox violation/);

    await harness.commands.get("sandbox").handler("violations off", harness.ctx);
    for (const entry of harness.entries) {
      assert.equal(renderEntry(renderer, entry), "", "disabling should hide all collected diagnostics");
    }

    await harness.commands.get("sandbox").handler("violations", harness.ctx);
    assert.match(renderEntry(renderer, harness.entries[0]!), /diagnostics-test/);

    await harness.handlers.get("session_shutdown")!({}, harness.ctx);
    await harness.handlers.get("session_start")!({}, harness.ctx);
    for (const entry of harness.entries) {
      assert.equal(renderEntry(renderer, entry), "", "a fresh session runtime should start hidden");
    }
  } finally {
    await harness.handlers.get("session_shutdown")!({}, harness.ctx);
  }
});

test("filesystem helper coalesces lifetime diagnostics without changing RPC behavior", { concurrency: false }, async (t) => {
  await configureAgentDir(t);
  const store = new ExtensionViolationStore();
  const helperCommandIds: string[] = [];
  installManagerMocks(t, {
    store,
    wrap(_command, metadata) {
      assert.ok(metadata?.commandId?.startsWith("pi-sandbox-helper:"));
      helperCommandIds.push(metadata.commandId);
      return { argv: fakeFilesystemHelperArgv(), env: process.env };
    },
  });

  const harness = createHarness();
  await harness.handlers.get("session_start")!({}, harness.ctx);
  const shutdown = harness.handlers.get("session_shutdown")!;

  try {
    assert.equal(helperCommandIds.length, 1);
    assert.equal(store.listeners.size, 1);
    assert.equal(harness.entries.length, 0);
    const firstCommandId = helperCommandIds[0]!;
    const ls = harness.tools.get("ls");
    assert.ok(ls);

    const delayedLine = "node(100) deny(1) file-read-data /private/helper-delayed";
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        store.addBatch(firstCommandId, [helperViolation(delayedLine, 100)]);
        resolve();
      }, 5);
    });
    await waitForEntryCount(harness.entries, 1);
    assert.equal(harness.entries[0]!.data.source, "filesystem helper");
    assert.match(harness.entries[0]!.data.diagnostic, /helper-delayed/);

    const renderer = harness.renderers.get(harness.entries[0]!.customType);
    assert.ok(renderer);
    assert.equal(renderEntry(renderer, harness.entries[0]!), "");

    const deniedLine = "node(101) deny(1) file-read-data /private/helper-denied";
    const deniedCall = ls.execute(
      "denied-filesystem-call",
      { path: "denied" },
      undefined,
      undefined,
      harness.ctx,
    );
    store.addBatch(firstCommandId, [helperViolation(deniedLine, 101)]);
    await assert.rejects(deniedCall, (error: Error) => {
      assert.equal(error.message, "filesystem access denied exactly");
      assert.doesNotMatch(error.message, /sandbox_violations|helper-denied/);
      return true;
    });
    await waitForEntryCount(harness.entries, 2);
    assert.match(harness.entries[1]!.data.diagnostic, /helper-denied/);

    const successLine = "node(102) deny(1) file-read-data /private/helper-success";
    const updates: any[] = [];
    const successfulCall = ls.execute(
      "successful-filesystem-call",
      { path: "." },
      undefined,
      (update) => updates.push(update),
      harness.ctx,
    );
    store.addBatch(firstCommandId, [helperViolation(successLine, 102)]);
    const successfulResult = await successfulCall;
    assert.equal(textResult(successfulResult), "(empty directory)");
    assert.doesNotMatch(JSON.stringify(successfulResult), /sandbox_violations|helper-success/);
    assert.doesNotMatch(JSON.stringify(updates), /sandbox_violations|helper-success/);
    await waitForEntryCount(harness.entries, 3);

    const repeatedLine = "node(103) deny(1) file-read-data /private/helper-repeated";
    const otherLine = "node(104) deny(1) file-read-data /private/helper-other";
    const repeatedOccurrence = helperViolation(repeatedLine, 103);
    store.addBatch(firstCommandId, [
      repeatedOccurrence,
      { ...repeatedOccurrence },
      helperViolation(otherLine, 104),
    ]);
    store.addBatch(firstCommandId, [
      { ...repeatedOccurrence },
      { ...repeatedOccurrence },
    ]);
    store.notify();
    store.notify();
    await waitForEntryCount(harness.entries, 4);
    assert.match(harness.entries[3]!.data.diagnostic, /helper-repeated.*\[4 occurrences\]/s);
    assert.match(harness.entries[3]!.data.diagnostic, /helper-other/);
    await ls.execute("later-clean-call", { path: "." }, undefined, undefined, harness.ctx);
    assert.equal(harness.entries.length, 4, "retained helper history must not be re-appended");

    const firstConcurrentCall = ls.execute(
      "concurrent-one",
      { path: "slow-one" },
      undefined,
      undefined,
      harness.ctx,
    );
    const secondConcurrentCall = ls.execute(
      "concurrent-two",
      { path: "slow-two" },
      undefined,
      undefined,
      harness.ctx,
    );
    const concurrentFirstLine = "node(105) deny(1) file-read-data /private/concurrent-one";
    const concurrentSecondLine = "node(106) deny(1) file-read-data /private/concurrent-two";
    store.addBatch(firstCommandId, [
      helperViolation(concurrentFirstLine, 105),
      helperViolation(concurrentSecondLine, 106),
    ]);
    const concurrentResults = await Promise.all([firstConcurrentCall, secondConcurrentCall]);
    assert.equal(helperCommandIds.length, 1, "concurrent calls must share the helper");
    assert.ok(concurrentResults.every((result) => textResult(result) === "(empty directory)"));
    await waitForEntryCount(harness.entries, 5);
    assert.match(harness.entries[4]!.data.diagnostic, /concurrent-one/);
    assert.match(harness.entries[4]!.data.diagnostic, /concurrent-two/);

    await harness.commands.get("sandbox").handler("violations on", harness.ctx);
    for (const entry of harness.entries) {
      assert.match(renderEntry(renderer, entry), /Sandbox violation — filesystem helper/);
    }
    const shownLine = "node(107) deny(1) file-read-data /private/helper-shown";
    store.addBatch(firstCommandId, [helperViolation(shownLine, 107)]);
    await waitForEntryCount(harness.entries, 6);
    assert.match(renderEntry(renderer, harness.entries[5]!), /helper-shown/);

    await harness.commands.get("sandbox").handler("violations off", harness.ctx);
    for (const entry of harness.entries) assert.equal(renderEntry(renderer, entry), "");

    let crashError = "";
    await assert.rejects(
      ls.execute("crashing-call", { path: "crash" }, undefined, undefined, harness.ctx),
      (error: Error) => {
        crashError = error.message;
        assert.match(error.message, /Sandbox helper (?:exited \(code 23\)|stdout closed)/);
        assert.doesNotMatch(error.message, /sandbox_violations|helper-(?:delayed|denied|success|shown)/);
        return true;
      },
    );
    await nextTurn();
    assert.equal(store.listeners.size, 0, "a crashed helper must release its listener");
    assert.equal(store.unsubscribeCount, 1);

    const entriesAfterCrash = harness.entries.length;
    store.addBatch(firstCommandId, [
      helperViolation("node(108) deny(1) file-read-data /private/too-late", 108),
    ]);
    assert.equal(harness.entries.length, entriesAfterCrash);

    const restartedResult = await ls.execute(
      "restart-call",
      { path: "." },
      undefined,
      undefined,
      harness.ctx,
    );
    assert.equal(textResult(restartedResult), "(empty directory)");
    assert.equal(helperCommandIds.length, 2);
    assert.notEqual(helperCommandIds[1], firstCommandId);
    assert.equal(store.listeners.size, 1);

    const restartedLine = "node(109) deny(1) file-read-data /private/helper-restarted";
    store.addBatch(helperCommandIds[1]!, [helperViolation(restartedLine, 109)]);
    await waitForEntryCount(harness.entries, entriesAfterCrash + 1);
    assert.match(harness.entries.at(-1)!.data.diagnostic, /helper-restarted/);

    await harness.commands.get("sandbox").handler("", harness.ctx);
    const nonDiagnosticSurface = JSON.stringify({
      crashError,
      notifications: harness.notifications,
      statuses: harness.statuses,
      successfulResult,
      concurrentResults,
      updates,
    });
    assert.doesNotMatch(nonDiagnosticSurface, /sandbox_violations|helper-(?:delayed|denied|success|repeated|other|shown|restarted)/);

    await shutdown({}, harness.ctx);
    assert.equal(store.listeners.size, 0);
    assert.equal(store.unsubscribeCount, 2);
  } finally {
    if (store.listeners.size > 0) await shutdown({}, harness.ctx);
  }
});

test("filesystem helper flood creates one hidden bounded entry without changing RPC surfaces", { concurrency: false }, async (t) => {
  await configureAgentDir(t);
  const store = new ExtensionViolationStore();
  let helperCommandId = "";
  installManagerMocks(t, {
    store,
    wrap(_command, metadata) {
      assert.ok(metadata?.commandId?.startsWith("pi-sandbox-helper:"));
      helperCommandId = metadata.commandId;
      return { argv: fakeFilesystemHelperArgv(), env: process.env };
    },
  });

  const harness = createHarness();
  await harness.handlers.get("session_start")!({}, harness.ctx);
  const shutdown = harness.handlers.get("session_shutdown")!;

  try {
    assert.ok(helperCommandId);
    const ls = harness.tools.get("ls");
    assert.ok(ls);
    const updates: any[] = [];
    const resultPromise = ls.execute(
      "helper-flood",
      { path: "." },
      undefined,
      (update) => updates.push(update),
      harness.ctx,
    );

    const longLine = `node(0) deny(1) file-read-data /private/${"x".repeat(2_500)}`;
    for (let index = 0; index < 300; index++) {
      store.addBatch(helperCommandId, [
        helperViolation(
          index === 0
            ? longLine
            : `node(${index}) deny(1) file-read-data /private/flood-${index}`,
          index,
        ),
      ]);
    }

    const result = await resultPromise;
    assert.equal(textResult(result), "(empty directory)");
    assert.doesNotMatch(JSON.stringify(result), /sandbox_violations|flood-/);
    assert.doesNotMatch(JSON.stringify(updates), /sandbox_violations|flood-/);
    await waitForEntryCount(harness.entries, 1);

    const entry = harness.entries[0]!;
    assert.equal(entry.data.source, "filesystem helper");
    const diagnosticLines = entry.data.diagnostic.split(EOL).slice(1, -1);
    const retainedDetails = diagnosticLines.slice(0, -1);
    assert.equal(retainedDetails.length, 20);
    assert.ok(retainedDetails.every((line) => line.length <= 2_000));
    assert.equal(retainedDetails[0]!.length, 2_000);
    assert.match(retainedDetails[0]!, /… \[line truncated\]$/);
    assert.equal(diagnosticLines.at(-1), "[280 additional occurrences omitted]");

    const renderer = harness.renderers.get(entry.customType);
    assert.ok(renderer);
    assert.equal(renderEntry(renderer, entry), "", "flood diagnostics should be hidden by default");
    await harness.commands.get("sandbox").handler("violations on", harness.ctx);
    assert.match(renderEntry(renderer, entry), /Sandbox violation — filesystem helper/);
    assert.match(renderEntry(renderer, entry), /additional occurrences omitted/);
    await harness.commands.get("sandbox").handler("violations off", harness.ctx);
    assert.equal(renderEntry(renderer, entry), "");

    await assert.rejects(
      ls.execute("denied-after-flood", { path: "denied" }, undefined, undefined, harness.ctx),
      (error: Error) => {
        assert.equal(error.message, "filesystem access denied exactly");
        assert.doesNotMatch(error.message, /sandbox_violations|flood-/);
        return true;
      },
    );
    assert.equal(harness.entries.length, 1);
    assert.doesNotMatch(
      JSON.stringify({ notifications: harness.notifications, statuses: harness.statuses }),
      /sandbox_violations|flood-/,
    );
  } finally {
    await shutdown({}, harness.ctx);
  }
});

test("filesystem helper startup violations are entries but not sandbox state errors", { concurrency: false }, async (t) => {
  await configureAgentDir(t);
  const violationLine = "node(456) deny(1) file-read-data /private/helper-diagnostics-test";
  installManagerMocks(t, {
    getViolations(commandId) {
      if (!commandId.startsWith("pi-sandbox-helper:")) return [];
      return [{ line: violationLine, command: commandId, timestamp: new Date(0) }];
    },
    wrap() {
      return { argv: [process.execPath, "-e", "process.exit(17)"], env: process.env };
    },
  });

  const harness = createHarness();
  await harness.handlers.get("session_start")!({}, harness.ctx);

  assert.equal(harness.entries.length, 1);
  assert.equal(harness.entries[0]!.data.source, "filesystem helper");
  assert.match(harness.entries[0]!.data.diagnostic, /helper-diagnostics-test/);
  assert.ok(harness.notifications.length > 0);
  assert.doesNotMatch(harness.notifications.map((entry) => entry.message).join("\n"), /helper-diagnostics-test|sandbox_violations/);

  const read = harness.tools.get("read");
  assert.ok(read);
  let sandboxError = "";
  await assert.rejects(
    read.execute("read-after-helper-failure", { path: "package.json" }, undefined, undefined, harness.ctx),
    (error: Error) => {
      sandboxError = error.message;
      assert.match(error.message, /Sandbox unavailable/);
      assert.doesNotMatch(error.message, /helper-diagnostics-test|sandbox_violations/);
      return true;
    },
  );

  const renderer = harness.renderers.get(harness.entries[0]!.customType);
  assert.ok(renderer);
  assert.equal(renderEntry(renderer, harness.entries[0]!), "", "helper diagnostics should start hidden");

  await harness.commands.get("sandbox").handler("violations on", harness.ctx);
  assert.match(renderEntry(renderer, harness.entries[0]!), /filesystem helper/);
  await assert.rejects(
    read.execute("read-after-toggle", { path: "package.json" }, undefined, undefined, harness.ctx),
    (error: Error) => {
      assert.equal(error.message, sandboxError);
      assert.doesNotMatch(error.message, /helper-diagnostics-test|sandbox_violations/);
      return true;
    },
  );
  await harness.handlers.get("session_shutdown")!({}, harness.ctx);
});
