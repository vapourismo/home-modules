import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import type {
  BashOperations,
  ExtensionAPI,
  ExtensionContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import {
  CONFIG_DIR_NAME,
  createBashToolDefinition,
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
  getAgentDir,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { createSandboxBashOperations } from "./src/bash.ts";
import {
  loadPolicy,
  policyRuleCounts,
  type ExtensionSandboxConfig,
  type PolicySource,
} from "./src/config.ts";
import { assertSupportedPlatform } from "./src/platform.ts";
import { HelperRpcClient } from "./src/rpc.ts";
import { createSandboxToolDefinitions } from "./src/tools.ts";
import {
  encodeUntrustedDisplay,
  requestUnsandboxedApproval,
} from "./src/unsandboxed-confirmation.ts";
import { subscribeToSandboxViolations } from "./src/violations.ts";

const ENTRY_PATH = fileURLToPath(import.meta.url);
const HELPER_PATH = fileURLToPath(new URL("./helper.mjs", import.meta.url));
const OVERRIDDEN_TOOL_NAMES = [
  "read",
  "bash",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
] as const;

type SandboxState =
  | { kind: "active"; policy: ExtensionSandboxConfig; sources: PolicySource[] }
  | {
      kind: "disabled";
      reason: string;
      policy?: ExtensionSandboxConfig;
      sources: PolicySource[];
    }
  | {
      kind: "unavailable";
      reason: string;
      policy?: ExtensionSandboxConfig;
      sources: PolicySource[];
    };

type StatefulToolName = Exclude<(typeof OVERRIDDEN_TOOL_NAMES)[number], "bash">;
type LocalToolDefinitionFactory = (cwd: string) => ToolDefinition<any, any>;
type SandboxViolationSource = "agent Bash" | "user Bash" | "filesystem helper";

interface SandboxViolationEntryData {
  diagnostic: string;
  source: SandboxViolationSource;
}

interface HelperLifecycle {
  client: HelperRpcClient;
  commandId: string;
  disposeViolationSubscription: () => void;
}

interface ResolvedBashConfig {
  shellPath?: string;
  shellCommandPrefix?: string;
}

const SANDBOX_VIOLATION_ENTRY_TYPE = "anthropic-sandbox-violation";

const localToolDefinitionFactories: Record<
  StatefulToolName,
  LocalToolDefinitionFactory
> = {
  read: createReadToolDefinition,
  write: createWriteToolDefinition,
  edit: createEditToolDefinition,
  ls: createLsToolDefinition,
  find: createFindToolDefinition,
  grep: createGrepToolDefinition,
};

function createLocalToolDefinition(
  name: StatefulToolName,
  cwd: string,
): ToolDefinition<any, any> {
  return localToolDefinitionFactories[name](cwd);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function blockedError(toolName: string, state: SandboxState): Error {
  const reason =
    state.kind === "unavailable"
      ? state.reason
      : `unexpected state ${state.kind}`;
  return new Error(
    `Sandbox unavailable: ${reason}. Sandboxing is enabled; refusing unsandboxed ${toolName} execution.`,
  );
}

function normalizeSourcePath(value: string): string {
  const withoutFile = value.startsWith("file://")
    ? fileURLToPath(value)
    : value;
  return path.normalize(withoutFile.replace(/^<|>$/g, ""));
}

export default function sandboxRuntimeExtension(pi: ExtensionAPI) {
  let violationDiagnosticsVisible = false;

  pi.registerEntryRenderer<SandboxViolationEntryData>(
    SANDBOX_VIOLATION_ENTRY_TYPE,
    (entry, _options, theme) => {
      const source = entry.data?.source ?? "unknown source";
      const diagnostic =
        entry.data?.diagnostic ?? "Diagnostic details unavailable";
      const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
      const text = new Text("", 0, 0);
      const rebuild = () => {
        text.setText(
          `${theme.fg("warning", theme.bold(`⚠ Sandbox violation — ${source}`))}\n${theme.fg("customMessageText", diagnostic)}`,
        );
      };
      box.addChild(text);
      rebuild();
      return {
        render(width: number) {
          return violationDiagnosticsVisible ? box.render(width) : [];
        },
        invalidate() {
          box.invalidate();
          rebuild();
        },
      };
    },
  );

  function appendSandboxViolation(
    diagnostic: string,
    source: SandboxViolationSource,
  ): void {
    if (!diagnostic) return;
    try {
      pi.appendEntry<SandboxViolationEntryData>(SANDBOX_VIOLATION_ENTRY_TYPE, {
        diagnostic,
        source,
      });
    } catch {
      // User-only diagnostics must not change sandboxed operation semantics.
    }
  }

  pi.registerFlag("no-sandbox", {
    description: "Explicitly disable Anthropic Sandbox Runtime enforcement",
    type: "boolean",
    default: false,
  });

  const processWorkingDirectory = process.cwd();
  let state: SandboxState = {
    kind: "unavailable",
    reason: "sandbox session has not started",
    sources: [],
  };
  let bashConfig: ResolvedBashConfig = {};
  let helper: HelperLifecycle | undefined;
  let helperStarting: Promise<HelperLifecycle> | undefined;
  let managerInitialized = false;
  let shuttingDown = false;
  const cleanedHelpers = new WeakSet<HelperLifecycle>();

  function cleanupHelper(lifecycle: HelperLifecycle): void {
    if (cleanedHelpers.has(lifecycle)) return;
    cleanedHelpers.add(lifecycle);
    try {
      lifecycle.disposeViolationSubscription();
    } catch {
      // Diagnostic cleanup must not affect helper or session cleanup.
    }
    SandboxManager.cleanupAfterCommand();
  }

  async function launchHelper(cwd: string): Promise<HelperLifecycle> {
    if (state.kind !== "active") throw blockedError("filesystem helper", state);
    const commandId = `pi-sandbox-helper:${process.pid}:${randomUUID()}`;
    const command = `exec ${shellQuote(process.execPath)} ${shellQuote(HELPER_PATH)}`;
    const wrapped = await SandboxManager.wrapWithSandboxArgv(
      command,
      undefined,
      undefined,
      undefined,
      cwd,
      { commandId, commandText: "pi sandbox filesystem helper" },
    );
    const disposeViolationSubscription = subscribeToSandboxViolations(
      commandId,
      (diagnostic) => appendSandboxViolation(diagnostic, "filesystem helper"),
    );

    let lifecycle: HelperLifecycle | undefined;
    try {
      const child = spawn(wrapped.argv[0]!, wrapped.argv.slice(1), {
        cwd,
        env: { ...wrapped.env, ...process.env },
        detached: true,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const client = new HelperRpcClient(child, () => {
        if (!lifecycle) return;
        const failed = lifecycle;
        void client.close().then(() => {
          if (helper === failed) helper = undefined;
          cleanupHelper(failed);
        });
      });
      lifecycle = { client, commandId, disposeViolationSubscription };
    } catch (error) {
      disposeViolationSubscription();
      SandboxManager.cleanupAfterCommand();
      throw error;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      await lifecycle.client.request("probe", {}, controller.signal);
    } catch (error) {
      await stopHelper(lifecycle, new Error("Sandbox helper startup failed"));
      throw new Error(`Sandbox helper startup failed: ${errorMessage(error)}`);
    } finally {
      clearTimeout(timer);
    }
    return lifecycle;
  }

  async function stopHelper(
    lifecycle: HelperLifecycle,
    reason: Error,
  ): Promise<void> {
    await lifecycle.client.close(reason);
    cleanupHelper(lifecycle);
  }

  async function ensureHelper(cwd = processWorkingDirectory): Promise<HelperRpcClient> {
    if (state.kind !== "active") throw blockedError("filesystem tool", state);
    if (shuttingDown) throw new Error("Sandbox session is shutting down");
    if (helper && !helper.client.isClosed) return helper.client;
    if (helper) {
      const replaced = helper;
      await replaced.client.close();
      if (helper === replaced) helper = undefined;
      cleanupHelper(replaced);
    }
    if (!helperStarting) {
      helperStarting = launchHelper(cwd)
        .then(async (started) => {
          if (shuttingDown) {
            await stopHelper(
              started,
              new Error("Sandbox session is shutting down"),
            );
            throw new Error("Sandbox session is shutting down");
          }
          helper = started;
          return started;
        })
        .catch(async (error) => {
          state = {
            kind: "unavailable",
            reason: errorMessage(error),
            policy: state.policy,
            sources: state.sources,
          };
          if (managerInitialized) {
            try {
              await SandboxManager.reset();
            } catch {}
            managerInitialized = false;
          }
          throw blockedError("filesystem tool", state);
        })
        .finally(() => {
          helperStarting = undefined;
        });
    }
    return (await helperStarting).client;
  }

  const sandboxDefinitions = createSandboxToolDefinitions(processWorkingDirectory, () =>
    ensureHelper(),
  );

  function createConfiguredBashToolDefinition(
    cwd: string,
    operations?: BashOperations,
  ): ReturnType<typeof createBashToolDefinition> {
    return createBashToolDefinition(cwd, {
      commandPrefix: bashConfig.shellCommandPrefix,
      shellPath: bashConfig.shellPath,
      operations,
    });
  }

  function registerStatefulTool(name: StatefulToolName): void {
    const sandboxDefinition = sandboxDefinitions[name] as ToolDefinition<
      any,
      any
    >;
    pi.registerTool({
      ...sandboxDefinition,
      async execute(id, params, signal, onUpdate, ctx) {
        if (state.kind === "disabled") {
          const localDefinition = createLocalToolDefinition(
            name,
            ctx?.cwd ?? processWorkingDirectory,
          );
          return localDefinition.execute(id, params, signal, onUpdate, ctx);
        }
        if (state.kind === "unavailable") throw blockedError(name, state);
        return sandboxDefinition.execute(id, params, signal, onUpdate, ctx);
      },
    });
  }

  const bashMetadata = createBashToolDefinition(processWorkingDirectory);
  const unsandboxedBashMetadata: typeof bashMetadata = {
    ...bashMetadata,
    name: "unsandboxed_bash",
    label: "bash (unsandboxed)",
    description:
      "Execute a local Bash command without Sandbox Runtime protections. Use this fallback only after sandboxed bash fails because of sandbox restrictions. Every invocation requires explicit user confirmation.",
    executionMode: "sequential",
    promptSnippet:
      "Run Bash without Sandbox Runtime only after sandboxed bash fails because of sandbox restrictions",
    promptGuidelines: [
      "Use unsandboxed_bash only after sandboxed bash fails because Sandbox Runtime restrictions blocked the command; never use unsandboxed_bash as the first choice.",
    ],
    renderCall(args, theme, context) {
      const state = context.state;
      if (context.executionStarted && state.startedAt === undefined) {
        state.startedAt = Date.now();
        state.endedAt = undefined;
      }
      const text =
        context.lastComponent instanceof Text
          ? context.lastComponent
          : new Text("", 0, 0);
      const command =
        typeof args?.command === "string"
          ? encodeUntrustedDisplay(args.command)
          : "...";
      const timeout =
        typeof args?.timeout === "number"
          ? theme.fg("muted", ` (timeout ${args.timeout}s)`)
          : "";
      text.setText(
        theme.fg("warning", theme.bold("UNSANDBOXED ")) +
          theme.fg("toolTitle", theme.bold(`$ ${command}`)) +
          timeout,
      );
      return text;
    },
    async execute(id, params, signal, onUpdate, ctx) {
      const cwd = ctx?.cwd ?? processWorkingDirectory;
      if (!ctx?.hasUI) {
        throw new Error(
          "Unsandboxed Bash requires explicit confirmation, but no dialog-capable UI is available.",
        );
      }

      const approved = await requestUnsandboxedApproval(
        ctx,
        params.command,
        cwd,
        signal,
      );
      if (!approved)
        throw new Error(
          "Unsandboxed Bash execution was not approved by the user.",
        );
      if (signal?.aborted)
        throw new Error("Unsandboxed Bash execution was cancelled.");

      const localDefinition = createConfiguredBashToolDefinition(cwd);
      return localDefinition.execute(id, params, signal, onUpdate, ctx);
    },
  };
  let toolOverridesRegistered = false;

  // Register dynamically after Pi has resolved the authoritative active set.
  // Replacing built-ins by name preserves active names, while keeping inactive
  // definitions available for later activation.
  function registerToolOverrides(): void {
    if (toolOverridesRegistered) return;

    registerStatefulTool("read");
    pi.registerTool({
      ...bashMetadata,
      async execute(id, params, signal, onUpdate, ctx) {
        if (state.kind === "unavailable") throw blockedError("bash", state);
        const cwd = ctx?.cwd ?? processWorkingDirectory;
        const definition =
          state.kind === "disabled"
            ? createConfiguredBashToolDefinition(cwd)
            : createConfiguredBashToolDefinition(
                cwd,
                createSandboxBashOperations(
                  `pi-bash-tool:${id}`,
                  (diagnostic) =>
                    appendSandboxViolation(diagnostic, "agent Bash"),
                  bashConfig.shellPath,
                ),
              );
        return definition.execute(id, params, signal, onUpdate, ctx);
      },
    });
    registerStatefulTool("edit");
    registerStatefulTool("write");
    registerStatefulTool("grep");
    registerStatefulTool("find");
    registerStatefulTool("ls");
    pi.registerTool(unsandboxedBashMetadata);

    toolOverridesRegistered = true;
  }

  pi.on("user_bash", (event) => {
    if (state.kind === "disabled") return;
    if (state.kind === "unavailable") {
      return {
        operations: {
          async exec() {
            throw blockedError("user bash", state);
          },
        },
      };
    }
    return {
      operations: createSandboxBashOperations(
        `pi-user-bash:${event.excludeFromContext ? "context-excluded" : "context"}`,
        (diagnostic) => appendSandboxViolation(diagnostic, "user Bash"),
        bashConfig.shellPath,
      ),
    };
  });

  function setUiState(ctx: ExtensionContext): void {
    ctx.ui.setStatus(
      "anthropic-sandbox",
      state.kind === "active" ? "sandboxed" : "no sandbox",
    );
  }

  pi.on("session_start", async (_event, ctx) => {
    violationDiagnosticsVisible = false;
    bashConfig = {};
    registerToolOverrides();
    shuttingDown = false;
    state = {
      kind: "unavailable",
      reason: "sandbox initialization is in progress",
      sources: [],
    };

    try {
      const settingsManager = SettingsManager.create(ctx.cwd, getAgentDir(), {
        projectTrusted: ctx.isProjectTrusted(),
      });
      bashConfig = {
        shellPath: settingsManager.getShellPath(),
        shellCommandPrefix: settingsManager.getShellCommandPrefix(),
      };
      assertSupportedPlatform();
      if (pi.getFlag("no-sandbox") === true) {
        state = {
          kind: "disabled",
          reason: "disabled by --no-sandbox",
          sources: [],
        };
        setUiState(ctx);
        return;
      }

      const loaded = await loadPolicy({
        agentDir: getAgentDir(),
        cwd: processWorkingDirectory,
        configDirName: CONFIG_DIR_NAME,
        projectTrusted: ctx.isProjectTrusted(),
      });
      if (!loaded.config.enabled) {
        state = {
          kind: "disabled",
          reason: "disabled by sandbox.json (enabled: false)",
          policy: loaded.config,
          sources: loaded.sources,
        };
        setUiState(ctx);
        return;
      }
      if (!SandboxManager.isSupportedPlatform()) {
        throw new Error(
          `Anthropic Sandbox Runtime does not support ${process.platform}`,
        );
      }
      await SandboxManager.initialize(loaded.runtimeConfig, undefined, true);
      managerInitialized = true;
      state = {
        kind: "active",
        policy: loaded.config,
        sources: loaded.sources,
      };
      await ensureHelper(ctx.cwd);
      setUiState(ctx);
    } catch (error) {
      const previous = state;
      const failedHelper = helper;
      helper = undefined;
      if (failedHelper)
        await stopHelper(
          failedHelper,
          new Error("Sandbox initialization failed"),
        );
      if (managerInitialized) {
        try {
          await SandboxManager.reset();
        } catch {}
        managerInitialized = false;
      }
      state = {
        kind: "unavailable",
        reason: errorMessage(error),
        policy: previous.policy,
        sources: previous.sources,
      };
      setUiState(ctx);
      ctx.ui.notify(
        `Sandbox unavailable: ${state.reason}. Covered tools will fail closed.`,
        "error",
      );
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    shuttingDown = true;
    const activeHelper = helper;
    helper = undefined;
    if (activeHelper)
      await stopHelper(activeHelper, new Error("Sandbox session shut down"));
    if (helperStarting) {
      try {
        const starting = await helperStarting;
        await stopHelper(starting, new Error("Sandbox session shut down"));
      } catch {}
    }
    if (managerInitialized) {
      try {
        await SandboxManager.reset();
      } finally {
        managerInitialized = false;
      }
    }
    state = {
      kind: "unavailable",
      reason: "sandbox session has shut down",
      sources: [],
    };
    ctx.ui.setStatus("anthropic-sandbox", undefined);
  });

  pi.registerCommand("sandbox", {
    description: "Show Sandbox Runtime status or control violation diagnostics",
    handler: async (args, ctx) => {
      const commandArgs = args.trim().split(/\s+/).filter(Boolean);
      if (commandArgs.length > 0) {
        const validVisibilityCommand =
          commandArgs[0] === "violations" &&
          commandArgs.length <= 2 &&
          (commandArgs.length === 1 ||
            ["on", "off", "toggle"].includes(commandArgs[1]!));
        if (!validVisibilityCommand) {
          const usage = "Usage: /sandbox [violations [on|off|toggle]]";
          if (ctx.hasUI) ctx.ui.notify(usage, "error");
          else console.error(usage);
          return;
        }

        const action = commandArgs[1] ?? "toggle";
        violationDiagnosticsVisible =
          action === "on"
            ? true
            : action === "off"
              ? false
              : !violationDiagnosticsVisible;
        const output = `Sandbox violation diagnostics: ${violationDiagnosticsVisible ? "shown" : "hidden"}`;
        if (ctx.hasUI) ctx.ui.notify(output, "info");
        else console.log(output);
        return;
      }

      const activeTools = pi.getActiveTools();
      const allTools = pi.getAllTools();
      const covered = allTools.filter((tool) =>
        (OVERRIDDEN_TOOL_NAMES as readonly string[]).includes(tool.name),
      );
      const owned = covered
        .filter((tool) => {
          const sourcePath = tool.sourceInfo?.path;
          if (!sourcePath || sourcePath.startsWith("<builtin:")) return false;
          try {
            return (
              normalizeSourcePath(sourcePath) === path.normalize(ENTRY_PATH)
            );
          } catch {
            return (
              sourcePath.includes("pi-anthropic-sandbox-runtime") ||
              sourcePath.includes("sandbox-runtime/index.ts")
            );
          }
        })
        .map((tool) => tool.name);
      const lines = [
        `Sandbox status: ${state.kind}`,
        `Reason: ${state.kind === "active" ? "policy initialized and helper running" : state.reason}`,
        `Violation diagnostics: ${violationDiagnosticsVisible ? "shown" : "hidden"} (toggle with /sandbox violations)`,
        "Policy sources:",
        ...(state.sources.length
          ? state.sources.map(
              (source) =>
                `  ${source.scope}: ${source.path} (${source.ignored ? "ignored: project untrusted" : source.loaded ? "loaded" : "not found"})`,
            )
          : ["  (not loaded)"]),
      ];
      if (state.policy) {
        const counts = policyRuleCounts(state.policy);
        lines.push(
          `Rules: ${counts.allowedDomains} allowed domains, ${counts.deniedDomains} denied domains, ${counts.denyRead} deny-read, ${counts.allowRead} allow-read, ${counts.allowWrite} allow-write, ${counts.denyWrite} deny-write, ${counts.unixSockets} Unix sockets`,
        );
      }
      lines.push(
        `Active tools: ${activeTools.length ? activeTools.join(", ") : "(none)"}`,
        `Overrides from this extension: ${owned.length ? owned.join(", ") : "(none detected)"}`,
        "Covered definitions:",
        ...covered.map(
          (tool) =>
            `  ${tool.name}: ${tool.sourceInfo?.path ?? tool.sourceInfo?.source ?? "unknown"}`,
        ),
      );
      const output = lines.join("\n");
      if (ctx.hasUI)
        ctx.ui.notify(output, state.kind === "unavailable" ? "error" : "info");
      else console.log(output);
    },
  });

  // Existing CLI/settings activation remains authoritative.
}
