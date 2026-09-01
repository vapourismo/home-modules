import assert from "node:assert/strict";
import { access, chmod, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
  InMemoryCredentialStore,
} from "@earendil-works/pi-ai";
import {
  createAgentSession,
  createBashToolDefinition,
  DefaultResourceLoader,
  initTheme,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type ExtensionContext,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import {
  KeybindingsManager,
  TUI_KEYBINDINGS,
  type Component,
  type TUI,
} from "@earendil-works/pi-tui";
import sandboxRuntimeExtension from "../index.ts";
import {
  buildUnsandboxedApprovalDetails,
  decodeUntrustedDisplay,
  encodeUntrustedDisplay,
  UNSANDBOXED_CANCEL,
  UNSANDBOXED_RUN,
} from "../src/unsandboxed-confirmation.ts";

type Handler = (...args: any[]) => any;
type TuiDriver = (component: Component, tui: TUI) => void | Promise<void>;
type Select = (
  title: string,
  options: string[],
  opts?: { signal?: AbortSignal },
) => Promise<string | undefined>;

const fakeTheme = {
  fg(_color: string, text: string) {
    return text;
  },
  bg(_color: string, text: string) {
    return text;
  },
  bold(text: string) {
    return text;
  },
  italic(text: string) {
    return text;
  },
  strikethrough(text: string) {
    return text;
  },
} as any;

function createFakeTui(rows = 24, columns = 80): TUI {
  return {
    terminal: { rows, columns },
    requestRender() {},
  } as any;
}

function createTuiUi(
  driver: TuiDriver,
  rows = 24,
  columns = 80,
): ExtensionContext["ui"] {
  const tui = createFakeTui(rows, columns);
  const keybindings = new KeybindingsManager(TUI_KEYBINDINGS);
  return {
    async custom<T>(factory: any): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        let component: (Component & { dispose?(): void }) | undefined;
        let settled = false;
        const done = (value: T) => {
          if (settled) return;
          settled = true;
          component?.dispose?.();
          resolve(value);
        };
        Promise.resolve(factory(tui, fakeTheme, keybindings, done))
          .then(async (created) => {
            component = created;
            if (settled) {
              component.dispose?.();
              return;
            }
            await driver(component, tui);
          })
          .catch(reject);
      });
    },
    async select() {
      throw new Error("select should not be used in TUI mode");
    },
    setStatus() {},
    notify() {},
  } as any;
}

function createRpcUi(select: Select): ExtensionContext["ui"] {
  return {
    select,
    async custom() {
      throw new Error("custom should not be used in RPC mode");
    },
    setStatus() {},
    notify() {},
  } as any;
}

function createContext(
  cwd: string,
  mode: "tui" | "rpc" | "json",
  ui: ExtensionContext["ui"],
): ExtensionContext {
  return {
    cwd,
    mode,
    hasUI: mode === "tui" || mode === "rpc",
    isProjectTrusted: () => false,
    sessionManager: {
      getSessionId: () => "unsandboxed-bash-test-session",
      getSessionFile: () => undefined,
    },
    ui,
  } as any;
}

function createHarness(cwd: string, ctx: ExtensionContext) {
  const handlers = new Map<string, Handler>();
  const tools = new Map<string, ToolDefinition<any, any>>();

  sandboxRuntimeExtension({
    registerEntryRenderer() {},
    appendEntry() {},
    registerFlag() {},
    getFlag(name: string) {
      return name === "no-sandbox" ? true : undefined;
    },
    registerTool(definition: ToolDefinition<any, any>) {
      tools.set(definition.name, definition);
    },
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

  return { ctx, handlers, tools };
}

async function registerTools(harness: ReturnType<typeof createHarness>): Promise<void> {
  await harness.handlers.get("session_start")!({}, harness.ctx);
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function textResult(result: any): string {
  return result.content
    .map((entry: any) => (entry.type === "text" ? entry.text : ""))
    .join("");
}

const INTEGRATION_TIMEOUT_MS = 5_000;
const FIRST_TOOL_CALL_ID = "unsandboxed-first";
const SECOND_TOOL_CALL_ID = "unsandboxed-second";
const FIRST_COMMAND = "printf first-result";
const SECOND_COMMAND = "printf second-result";
let fauxProviderSequence = 0;

interface ControlledDialog {
  title: string;
  options: string[];
  signal: AbortSignal | undefined;
  abortObserved: boolean;
  settled: boolean;
  respond(value: string | undefined): void;
}

interface ToolEnd {
  id: string;
  isError: boolean;
  text: string;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitUntil(
  predicate: () => boolean,
  description: string,
  timeout = INTEGRATION_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${description}`);
    }
    await delay(5);
  }
}

async function bounded<T>(
  promise: Promise<T>,
  description: string,
  timeout = INTEGRATION_TIMEOUT_MS,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out waiting for ${description}`)),
          timeout,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function createConfirmationController(): {
  dialogs: ControlledDialog[];
  ui: ExtensionContext["ui"];
} {
  const dialogs: ControlledDialog[] = [];
  const ui = createRpcUi((title, options, opts) =>
    new Promise<string | undefined>((resolve) => {
      let abortListener: (() => void) | undefined;
      const dialog: ControlledDialog = {
        title,
        options,
        signal: opts?.signal,
        abortObserved: false,
        settled: false,
        respond(value) {
          if (dialog.settled) return;
          dialog.settled = true;
          if (abortListener && dialog.signal) {
            dialog.signal.removeEventListener("abort", abortListener);
          }
          resolve(value);
        },
      };
      abortListener = () => {
        dialog.abortObserved = true;
        dialog.respond(undefined);
      };
      dialogs.push(dialog);
      if (dialog.signal?.aborted) abortListener();
      else dialog.signal?.addEventListener("abort", abortListener, { once: true });
    }),
  );
  return { dialogs, ui };
}

async function createAgentIntegrationHarness(
  root: string,
  ui: ExtensionContext["ui"],
): Promise<{
  session: Awaited<ReturnType<typeof createAgentSession>>["session"];
  ends: ToolEnd[];
  dispose(): void;
}> {
  const providerId = `sandbox-runtime-faux-${++fauxProviderSequence}`;
  const faux = fauxProvider({ provider: providerId });
  const provider = {
    ...faux.provider,
    auth: {
      apiKey: {
        name: "Faux",
        resolve: async () => ({ auth: { apiKey: "faux-test-key" } }),
      },
    },
  };
  const modelRuntime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(),
    modelsPath: null,
    refreshOnCreate: false,
  });
  modelRuntime.registerNativeProvider(provider);
  await modelRuntime.refresh({ allowNetwork: false, providers: [providerId] });
  const model = modelRuntime.getModel(providerId, faux.getModel().id);
  assert.ok(model);

  faux.setResponses([
    fauxAssistantMessage(
      [
        fauxToolCall(
          "unsandboxed_bash",
          { command: FIRST_COMMAND },
          { id: FIRST_TOOL_CALL_ID },
        ),
        fauxToolCall(
          "unsandboxed_bash",
          { command: SECOND_COMMAND },
          { id: SECOND_TOOL_CALL_ID },
        ),
      ],
      { stopReason: "toolUse" },
    ),
    fauxAssistantMessage("finished"),
  ]);

  const agentDir = path.join(root, "agent");
  const settingsManager = SettingsManager.inMemory();
  const resourceLoader = new DefaultResourceLoader({
    cwd: root,
    agentDir,
    settingsManager,
    additionalExtensionPaths: [
      fileURLToPath(new URL("../index.ts", import.meta.url)),
    ],
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  await resourceLoader.reload();

  const created = await createAgentSession({
    cwd: root,
    agentDir,
    modelRuntime,
    model,
    thinkingLevel: "off",
    tools: ["unsandboxed_bash"],
    resourceLoader,
    sessionManager: SessionManager.inMemory(root),
    settingsManager,
  });
  assert.deepEqual(created.extensionsResult.errors, []);
  assert.equal(created.session.agent.toolExecution, "parallel");

  // Match the real --no-sandbox CLI state before session_start registers tools.
  created.extensionsResult.runtime.flagValues.set("no-sandbox", true);
  await created.session.bindExtensions({ uiContext: ui, mode: "rpc" });
  assert.deepEqual(created.session.getActiveToolNames(), ["unsandboxed_bash"]);

  const ends: ToolEnd[] = [];
  const unsubscribe = created.session.subscribe((event) => {
    if (event.type !== "tool_execution_end") return;
    ends.push({
      id: event.toolCallId,
      isError: event.isError,
      text: textResult(event.result),
    });
  });

  return {
    session: created.session,
    ends,
    dispose() {
      unsubscribe();
      created.session.dispose();
    },
  };
}

async function setupAgentIntegrationHarness(t: any) {
  const root = await mkdtemp(path.join(tmpdir(), "pi-unsandboxed-agent-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const confirmation = createConfirmationController();
  const harness = await createAgentIntegrationHarness(root, confirmation.ui);
  t.after(() => harness.dispose());
  return { ...harness, confirmation };
}

function extractPrefixedValue(title: string, prefix: string): string {
  return title
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length))
    .join("");
}

test("unsandboxed display encoding is ASCII-only, reversible, and unambiguous", () => {
  const samples = [
    "printable ASCII ~!",
    "backslash \\",
    "line\ncarriage\rreturn\ttab",
    "\x00\x01\x08\x0b\x0c\x1f",
    "\x7f\x80\x85\x9f",
    "\x1b[2J",
    "\x1b]0;OSC terminated by BEL\x07",
    "\x1b]0;OSC terminated by ST\x1b\\",
    "bidi \u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069",
    "separators \u2028\u2029",
    "printable non-ASCII caf\u00e9 \ud83d\ude00",
    `unpaired ${String.fromCharCode(0xd800)} middle ${String.fromCharCode(0xdfff)}`,
  ];

  for (const sample of samples) {
    const encoded = encodeUntrustedDisplay(sample);
    assert.match(encoded, /^[\x20-\x7e]*$/);
    assert.equal(decodeUntrustedDisplay(encoded), sample);
  }

  const allC0DelAndC1 = String.fromCharCode(
    ...Array.from({ length: 0x20 }, (_, code) => code),
    0x7f,
    ...Array.from({ length: 0x20 }, (_, offset) => 0x80 + offset),
  );
  const encodedControls = encodeUntrustedDisplay(allC0DelAndC1);
  assert.match(encodedControls, /^[\x20-\x7e]*$/);
  assert.equal(decodeUntrustedDisplay(encodedControls), allC0DelAndC1);

  assert.equal(encodeUntrustedDisplay("\n"), "\\n");
  assert.equal(encodeUntrustedDisplay("\\n"), "\\\\n");
  assert.notEqual(
    encodeUntrustedDisplay("\n"),
    encodeUntrustedDisplay("\\n"),
  );
  assert.equal(encodeUntrustedDisplay("\x1b[2J"), "\\x1B[2J");
  assert.equal(encodeUntrustedDisplay("\x7f\x80\x9f"), "\\x7F\\x80\\x9F");
  assert.equal(encodeUntrustedDisplay("\u202e\u2028\u2029"), "\\u{202E}\\u{2028}\\u{2029}");
  assert.equal(encodeUntrustedDisplay("\u00e9\ud83d\ude00"), "\\u{E9}\\u{1F600}");
  assert.equal(
    encodeUntrustedDisplay(`${String.fromCharCode(0xd800)}X${String.fromCharCode(0xdfff)}`),
    "\\u{D800}X\\u{DFFF}",
  );
});

test("approval details contain a full safe command identity and prefixed fields", () => {
  const command = `before\n\x1b]8;;forged\x07\u202eright-to-left \\n ${"x".repeat(200)} tail`;
  const cwd = `/tmp/control-\x1b[2J-\u2029-${String.fromCharCode(0xd800)}`;
  const details = buildUnsandboxedApprovalDetails(command, cwd);

  assert.match(details.rpcTitle, /^[\x09\x0a\x0d\x20-\x7e]*$/);
  assert.equal(extractPrefixedValue(details.rpcTitle, "C> "), details.escapedCommand);
  assert.equal(extractPrefixedValue(details.rpcTitle, "D> "), details.escapedCwd);
  assert.equal(decodeUntrustedDisplay(details.escapedCommand), command);
  assert.equal(decodeUntrustedDisplay(details.escapedCwd), cwd);
  assert.match(details.identity, /UTF-8 bytes; SHA-256 [0-9a-f]{64}$/);
  assert.ok(details.rpcTitle.includes(details.identity));
  assert.ok(!details.rpcTitle.includes("\x1b"));
  assert.ok(!details.rpcTitle.includes("\u202e"));
  assert.ok(!details.rpcTitle.includes(String.fromCharCode(0xd800)));
});

test("unsandboxed_bash has Bash-compatible parameters and fallback-only guidance", async () => {
  const ctx = createContext(
    process.cwd(),
    "tui",
    createTuiUi((component) => component.handleInput?.("\r")),
  );
  const harness = createHarness(process.cwd(), ctx);
  await registerTools(harness);

  const tool = harness.tools.get("unsandboxed_bash");
  assert.ok(tool);
  assert.equal(tool.name, "unsandboxed_bash");
  assert.equal(tool.label, "bash (unsandboxed)");
  assert.equal(tool.executionMode, "sequential");
  assert.deepEqual(tool.parameters, createBashToolDefinition(process.cwd()).parameters);

  const guidance = [
    tool.description,
    tool.promptSnippet,
    ...(tool.promptGuidelines ?? []),
  ].join("\n");
  assert.match(guidance, /only after sandboxed bash fails/i);
  assert.match(guidance, /sandbox runtime|sandbox restrictions/i);
  assert.match(guidance, /explicit user confirmation/i);
});

test("TUI starts on Cancel; only navigating to Run unsandboxed executes", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-unsandboxed-bash-tui-"));
  const sessionCwd = path.join(root, "session");
  const activeCwd = path.join(root, "active");
  await Promise.all([mkdir(sessionCwd), mkdir(activeCwd)]);
  t.after(() => rm(root, { recursive: true, force: true }));

  const deniedPath = path.join(root, "default-denied");
  let initialScreen = "";
  const deniedCtx = createContext(
    activeCwd,
    "tui",
    createTuiUi((component) => {
      initialScreen = component.render(100).join("\n");
      component.handleInput?.("\r");
    }),
  );
  const deniedHarness = createHarness(sessionCwd, deniedCtx);
  await registerTools(deniedHarness);
  await assert.rejects(
    deniedHarness.tools.get("unsandboxed_bash")!.execute(
      "default-denied",
      { command: `printf started > ${shellQuote(deniedPath)}` },
      undefined,
      undefined,
      deniedCtx,
    ),
    /was not approved/,
  );
  assert.equal(await pathExists(deniedPath), false);
  assert.match(initialScreen, /WARNING: UNSANDBOXED BASH/);
  assert.match(initialScreen.replaceAll("\n", ""), /SHA-256[0-9a-f]{64}/);
  assert.match(initialScreen, /Actions: > Cancel\s+Run unsandboxed/);

  const screens: string[] = [];
  const approvedCtx = createContext(
    activeCwd,
    "tui",
    createTuiUi((component) => {
      screens.push(component.render(100).join("\n"));
      component.handleInput?.("\x1b[B");
      screens.push(component.render(100).join("\n"));
      component.handleInput?.("\r");
    }),
  );
  const approvedHarness = createHarness(sessionCwd, approvedCtx);
  await registerTools(approvedHarness);
  const result = await approvedHarness.tools.get("unsandboxed_bash")!.execute(
    "approved-call",
    { command: "printf 'normal Bash output\\n'; pwd -P" },
    undefined,
    undefined,
    approvedCtx,
  );

  assert.equal(
    textResult(result),
    `normal Bash output\n${await realpath(activeCwd)}\n`,
  );
  assert.match(screens[0]!, /C> printf 'normal Bash output\\\\n'; pwd -P/);
  assert.match(screens[0]!, /D> /);
  assert.match(screens[1]!, /Cancel\s+> Run unsandboxed/);
});

test("approved unsandboxed_bash uses the trusted project shell and command prefix", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-unsandboxed-bash-settings-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, ".pi"));
  const shellPath = path.join(root, "configured-shell");
  await writeFile(shellPath, `#!/bin/sh
printf 'configured-shell-marker\\n'
exec /bin/bash "$@"
`);
  await chmod(shellPath, 0o755);
  await writeFile(
    path.join(root, ".pi", "settings.json"),
    JSON.stringify({
      shellPath,
      shellCommandPrefix: "printf 'configured-prefix-marker\\n'",
    }),
  );

  const ctx = createContext(
    root,
    "rpc",
    createRpcUi(async () => UNSANDBOXED_RUN),
  );
  ctx.isProjectTrusted = () => true;
  const harness = createHarness(root, ctx);
  await registerTools(harness);

  const result = await harness.tools.get("unsandboxed_bash")!.execute(
    "configured-unsandboxed",
    { command: "printf 'configured-command-marker\\n'" },
    undefined,
    undefined,
    ctx,
  );

  assert.equal(
    textResult(result),
    "configured-shell-marker\nconfigured-prefix-marker\nconfigured-command-marker\n",
  );
});

test("RPC approval sends complete safe details with denial-first options", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-unsandboxed-bash-rpc-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const requests: Array<{
    title: string;
    options: string[];
    signal: AbortSignal | undefined;
  }> = [];
  const command = "printf rpc-approved";
  const controller = new AbortController();
  const ctx = createContext(
    root,
    "rpc",
    createRpcUi(async (title, options, opts) => {
      requests.push({ title, options, signal: opts?.signal });
      return UNSANDBOXED_RUN;
    }),
  );
  const harness = createHarness(root, ctx);
  await registerTools(harness);
  const result = await harness.tools.get("unsandboxed_bash")!.execute(
    "rpc-approved",
    { command },
    controller.signal,
    undefined,
    ctx,
  );

  assert.equal(textResult(result), "rpc-approved");
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]!.options, [
    UNSANDBOXED_CANCEL,
    UNSANDBOXED_RUN,
  ]);
  assert.equal(requests[0]!.signal, controller.signal);
  const details = buildUnsandboxedApprovalDetails(command, root);
  assert.equal(
    extractPrefixedValue(requests[0]!.title, "C> "),
    details.escapedCommand,
  );
  assert.equal(
    extractPrefixedValue(requests[0]!.title, "D> "),
    details.escapedCwd,
  );
  assert.ok(requests[0]!.title.includes(details.identity));
});

test("large TUI details remain complete and reachable through paging", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-unsandboxed-bash-pages-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const command = `${"x".repeat(1500)}TAIL-MARKER\n\x1b[2J`;
  const details = buildUnsandboxedApprovalDetails(command, root);
  const pages: string[] = [];
  let retainedCommand = "";
  let retainedCwd = "";
  const ctx = createContext(
    root,
    "tui",
    createTuiUi((component, tui) => {
      for (let page = 0; page < 100; page++) {
        const lines = component.render(80);
        assert.ok(lines.length <= tui.terminal.rows);
        const rendered = lines.join("\n");
        pages.push(rendered);
        const match = rendered.match(/Details: lines (\d+)-(\d+) of (\d+)/);
        assert.ok(match);
        if (match[2] === match[3]) break;
        component.handleInput?.("\x1b[6~");
      }
      const allDetailLines = (component as any).detailLines as Array<{
        kind: string;
        text: string;
      }>;
      retainedCommand = allDetailLines
        .filter((line) => line.kind === "command")
        .map((line) => line.text.slice(3))
        .join("");
      retainedCwd = allDetailLines
        .filter((line) => line.kind === "cwd")
        .map((line) => line.text.slice(3))
        .join("");

      (tui.terminal as any).rows = 12;
      component.invalidate();
      const resizedLines = component.render(60);
      assert.ok(resizedLines.length <= tui.terminal.rows);
      const resizedPosition = resizedLines
        .join("\n")
        .match(/Details: lines (\d+)-(\d+) of (\d+)/);
      assert.ok(resizedPosition);
      assert.equal(resizedPosition[2], resizedPosition[3]);
      component.handleInput?.("\x1b");
    }, 10, 80),
  );
  const harness = createHarness(root, ctx);
  await registerTools(harness);
  await assert.rejects(
    harness.tools.get("unsandboxed_bash")!.execute(
      "large-denied",
      { command },
      undefined,
      undefined,
      ctx,
    ),
    /was not approved/,
  );

  assert.ok(pages.length > 2);
  assert.ok(
    pages[0]!.replaceAll(/\s/g, "").includes(details.identity.replaceAll(/\s/g, "")),
  );
  assert.ok(pages.some((page) => page.includes("TAIL-MARKER")));
  assert.ok(pages.some((page) => page.includes("D> ")));
  assert.equal(retainedCommand, details.escapedCommand);
  assert.equal(retainedCwd, details.escapedCwd);
  assert.match(pages.at(-1)!, /Details: lines (\d+)-\1 of \1|D> /);
});

test("Escape, rejection, signal abort, and post-approval abort prevent process creation", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-unsandboxed-bash-denied-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const cases: Array<{
    name: string;
    create(): { ctx: ExtensionContext; signal?: AbortSignal };
  }> = [
    {
      name: "escape",
      create: () => ({
        ctx: createContext(
          root,
          "tui",
          createTuiUi((component) => component.handleInput?.("\x1b")),
        ),
      }),
    },
    {
      name: "rpc rejection",
      create: () => ({
        ctx: createContext(
          root,
          "rpc",
          createRpcUi(async () => UNSANDBOXED_CANCEL),
        ),
      }),
    },
    {
      name: "unknown RPC response",
      create: () => ({
        ctx: createContext(
          root,
          "rpc",
          createRpcUi(async () => "unexpected value"),
        ),
      }),
    },
    {
      name: "signal abort in dialog",
      create: () => {
        const controller = new AbortController();
        return {
          signal: controller.signal,
          ctx: createContext(
            root,
            "tui",
            createTuiUi(() => controller.abort()),
          ),
        };
      },
    },
    {
      name: "abort immediately after approval",
      create: () => {
        const controller = new AbortController();
        return {
          signal: controller.signal,
          ctx: createContext(
            root,
            "rpc",
            createRpcUi(async () => {
              controller.abort();
              return UNSANDBOXED_RUN;
            }),
          ),
        };
      },
    },
  ];

  for (const testCase of cases) {
    const sideEffectPath = path.join(root, testCase.name.replaceAll(" ", "-"));
    const { ctx, signal } = testCase.create();
    const harness = createHarness(root, ctx);
    await registerTools(harness);
    await assert.rejects(
      harness.tools.get("unsandboxed_bash")!.execute(
        testCase.name,
        { command: `printf started > ${shellQuote(sideEffectPath)}` },
        signal,
        undefined,
        ctx,
      ),
      /was not approved/,
      testCase.name,
    );
    assert.equal(await pathExists(sideEffectPath), false, testCase.name);
  }
});

test("unsandboxed_bash fails closed without dialog-capable UI", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-unsandboxed-bash-no-ui-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  let dialogCalls = 0;
  const ui = createRpcUi(async () => {
    dialogCalls++;
    return UNSANDBOXED_RUN;
  });
  const registrationCtx = createContext(root, "rpc", ui);
  const harness = createHarness(root, registrationCtx);
  await registerTools(harness);
  const noUiContext = createContext(root, "json", ui);
  const sideEffectPath = path.join(root, "no-ui");

  await assert.rejects(
    harness.tools.get("unsandboxed_bash")!.execute(
      "no-ui-call",
      { command: `printf started > ${shellQuote(sideEffectPath)}` },
      undefined,
      undefined,
      noUiContext,
    ),
    /no dialog-capable UI is available/,
  );
  assert.equal(dialogCalls, 0);
  assert.equal(await pathExists(sideEffectPath), false);
});

test("unsandboxed_bash requests fresh RPC approval for every invocation", async () => {
  let selectCalls = 0;
  const ctx = createContext(
    process.cwd(),
    "rpc",
    createRpcUi(async () => {
      selectCalls++;
      return UNSANDBOXED_RUN;
    }),
  );
  const harness = createHarness(process.cwd(), ctx);
  await registerTools(harness);
  const tool = harness.tools.get("unsandboxed_bash")!;

  for (const id of ["first-call", "second-call"]) {
    const result = await tool.execute(
      id,
      { command: "printf approved" },
      undefined,
      undefined,
      ctx,
    );
    assert.equal(textResult(result), "approved");
  }
  assert.equal(selectCalls, 2);
});

test("AgentSession serializes same-response unsandboxed confirmations and results", async (t) => {
  const { session, ends, confirmation } = await setupAgentIntegrationHarness(t);
  const prompt = session.prompt("Run both unsandboxed commands.");

  await waitUntil(() => confirmation.dialogs.length === 1, "the first dialog");
  await delay(25);
  assert.equal(confirmation.dialogs.length, 1);
  assert.equal(
    confirmation.dialogs.filter((dialog) => !dialog.settled).length,
    1,
  );
  assert.ok(confirmation.dialogs[0]!.title.includes(FIRST_COMMAND));
  assert.deepEqual(confirmation.dialogs[0]!.options, [
    UNSANDBOXED_CANCEL,
    UNSANDBOXED_RUN,
  ]);
  assert.deepEqual(ends, []);

  confirmation.dialogs[0]!.respond(UNSANDBOXED_RUN);
  await waitUntil(() => confirmation.dialogs.length === 2, "the second dialog");
  assert.ok(confirmation.dialogs[1]!.title.includes(SECOND_COMMAND));
  assert.deepEqual(
    ends.map((entry) => [entry.id, entry.isError, entry.text]),
    [[FIRST_TOOL_CALL_ID, false, "first-result"]],
  );

  confirmation.dialogs[1]!.respond(UNSANDBOXED_RUN);
  await bounded(prompt, "the two-call prompt");
  assert.deepEqual(
    ends.map((entry) => [entry.id, entry.isError, entry.text]),
    [
      [FIRST_TOOL_CALL_ID, false, "first-result"],
      [SECOND_TOOL_CALL_ID, false, "second-result"],
    ],
  );
});

test("AgentSession isolates rejection at either sequential dialog", async (t) => {
  for (const rejectedIndex of [0, 1] as const) {
    await t.test(`reject dialog ${rejectedIndex + 1}`, async (t: any) => {
      const { session, ends, confirmation } =
        await setupAgentIntegrationHarness(t);
      const prompt = session.prompt("Run both unsandboxed commands.");

      await waitUntil(
        () => confirmation.dialogs.length === 1,
        "the first rejection-case dialog",
      );
      confirmation.dialogs[0]!.respond(
        rejectedIndex === 0 ? UNSANDBOXED_CANCEL : UNSANDBOXED_RUN,
      );
      await waitUntil(
        () => confirmation.dialogs.length === 2,
        "the second rejection-case dialog",
      );
      assert.deepEqual(ends.map((entry) => entry.id), [FIRST_TOOL_CALL_ID]);
      confirmation.dialogs[1]!.respond(
        rejectedIndex === 1 ? UNSANDBOXED_CANCEL : UNSANDBOXED_RUN,
      );
      await bounded(prompt, `rejection-case prompt ${rejectedIndex + 1}`);

      assert.deepEqual(
        confirmation.dialogs.map((dialog) =>
          dialog.title.includes(FIRST_COMMAND),
        ),
        [true, false],
      );
      assert.ok(confirmation.dialogs[1]!.title.includes(SECOND_COMMAND));
      assert.deepEqual(ends.map((entry) => entry.id), [
        FIRST_TOOL_CALL_ID,
        SECOND_TOOL_CALL_ID,
      ]);
      assert.deepEqual(ends.map((entry) => entry.isError), [
        rejectedIndex === 0,
        rejectedIndex === 1,
      ]);
      for (const [index, entry] of ends.entries()) {
        if (index === rejectedIndex) {
          assert.match(entry.text, /was not approved/);
        } else {
          assert.equal(entry.text, index === 0 ? "first-result" : "second-result");
        }
      }
    });
  }
});

test("AgentSession abort settles while either sequential dialog is active", async (t) => {
  for (const activeIndex of [0, 1] as const) {
    await t.test(`abort dialog ${activeIndex + 1}`, async (t: any) => {
      const { session, ends, confirmation } =
        await setupAgentIntegrationHarness(t);
      const prompt = session.prompt("Run both unsandboxed commands.");

      await waitUntil(
        () => confirmation.dialogs.length === 1,
        "the first abort-case dialog",
      );
      if (activeIndex === 1) {
        confirmation.dialogs[0]!.respond(UNSANDBOXED_RUN);
        await waitUntil(
          () => confirmation.dialogs.length === 2,
          "the second abort-case dialog",
        );
      }

      const activeDialog = confirmation.dialogs[activeIndex]!;
      const batchSignal = activeDialog.signal;
      assert.ok(batchSignal);
      assert.equal(batchSignal, session.agent.signal);
      assert.equal(batchSignal.aborted, false);

      const abort = session.abort();
      const settled = await bounded(
        Promise.allSettled([prompt, abort]),
        `prompt and abort for dialog ${activeIndex + 1}`,
      );
      assert.deepEqual(
        settled.map((result) => result.status),
        ["fulfilled", "fulfilled"],
      );
      assert.equal(batchSignal.aborted, true);
      assert.equal(activeDialog.abortObserved, true);
      await delay(25);
      assert.equal(confirmation.dialogs.length, activeIndex + 1);
      assert.deepEqual(
        ends.map((entry) => entry.id),
        activeIndex === 0
          ? [FIRST_TOOL_CALL_ID]
          : [FIRST_TOOL_CALL_ID, SECOND_TOOL_CALL_ID],
      );
      assert.deepEqual(
        ends.map((entry) => entry.isError),
        activeIndex === 0 ? [true] : [false, true],
      );
    });
  }
});

test("pending and settled call rendering is safely marked while Bash result rendering is preserved", async () => {
  const ctx = createContext(
    process.cwd(),
    "tui",
    createTuiUi((component) => component.handleInput?.("\r")),
  );
  const harness = createHarness(process.cwd(), ctx);
  await registerTools(harness);
  const tool = harness.tools.get("unsandboxed_bash")!;
  assert.ok(tool.renderCall);
  assert.ok(tool.renderResult);

  const malicious = `echo before\n\x1b[2J\u202eafter\\n`;
  const state: any = {};
  const baseContext = {
    args: { command: malicious },
    toolCallId: "render-call",
    invalidate() {},
    lastComponent: undefined,
    state,
    cwd: process.cwd(),
    executionStarted: false,
    argsComplete: true,
    isPartial: true,
    expanded: true,
    showImages: true,
    isError: false,
  };
  const pending = tool.renderCall!(
    { command: malicious },
    fakeTheme,
    baseContext as any,
  );
  const pendingText = pending.render(200).join("\n");
  assert.match(pendingText, /^UNSANDBOXED \$ /);
  assert.ok(pendingText.includes(encodeUntrustedDisplay(malicious)));
  assert.ok(!pendingText.includes("\x1b"));
  assert.ok(!pendingText.includes("\u202e"));
  assert.equal(state.startedAt, undefined);

  const settled = tool.renderCall!(
    { command: malicious },
    fakeTheme,
    {
      ...baseContext,
      lastComponent: pending,
      executionStarted: true,
      isPartial: false,
    } as any,
  );
  assert.match(settled.render(200).join("\n"), /^UNSANDBOXED \$ /);
  assert.equal(typeof state.startedAt, "number");

  initTheme("dark");
  const resultComponent = tool.renderResult!(
    {
      content: [{ type: "text", text: "normal Bash output" }],
      details: undefined,
    },
    { expanded: true, isPartial: false },
    fakeTheme,
    {
      ...baseContext,
      executionStarted: true,
      isPartial: false,
      state,
      lastComponent: undefined,
    } as any,
  );
  const renderedResult = resultComponent.render(100).join("\n");
  assert.match(renderedResult, /normal Bash output/);
  assert.match(renderedResult, /Took \d+\.\d+s/);
});
