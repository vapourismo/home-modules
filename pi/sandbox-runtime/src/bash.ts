import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import { waitForChildProcess } from "./child-process.ts";
import { killProcessGroup } from "./rpc.ts";
import {
  sandboxViolationAnnotation,
  waitForSandboxViolationDelivery,
} from "./violations.ts";

export interface SandboxBashOperations {
  exec(command: string, cwd: string, options: {
    onData: (data: Buffer) => void;
    signal?: AbortSignal;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
  }): Promise<{ exitCode: number | null }>;
}

const MAX_TIMEOUT_SECONDS = 2_147_483_647 / 1000;

function timeoutMilliseconds(timeout: number | undefined): number | undefined {
  if (timeout === undefined) return undefined;
  if (!Number.isFinite(timeout) || timeout <= 0) throw new Error("Invalid timeout: must be a finite number of seconds");
  if (timeout > MAX_TIMEOUT_SECONDS) throw new Error(`Invalid timeout: maximum is ${MAX_TIMEOUT_SECONDS} seconds`);
  return timeout * 1000;
}

export type SandboxViolationReporter = (diagnostic: string) => void;

export function createSandboxBashOperations(
  commandIdPrefix = "pi-bash",
  reportViolation?: SandboxViolationReporter,
  shellPath?: string,
): SandboxBashOperations {
  return {
    async exec(command, cwd, { onData, signal, timeout, env }) {
      const timeoutMs = timeoutMilliseconds(timeout);
      if (signal?.aborted) throw new Error("aborted");
      const commandId = `${commandIdPrefix}:${randomUUID()}`;
      let child: ReturnType<typeof spawn> | undefined;
      let timer: NodeJS.Timeout | undefined;
      let timedOut = false;
      let abortHandler: (() => void) | undefined;

      const cleanupTerminationHandlers = () => {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        if (abortHandler) {
          signal?.removeEventListener("abort", abortHandler);
          abortHandler = undefined;
        }
      };

      try {
        const wrapped = await SandboxManager.wrapWithSandboxArgv(
          command,
          shellPath,
          undefined,
          signal,
          cwd,
          { commandId, commandText: command },
        );
        if (signal?.aborted) throw new Error("aborted");

        child = spawn(wrapped.argv[0]!, wrapped.argv.slice(1), {
          cwd,
          env: { ...wrapped.env, ...env },
          detached: true,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
        });

        abortHandler = () => {
          if (child?.pid) killProcessGroup(child.pid);
        };
        if (signal) signal.addEventListener("abort", abortHandler, { once: true });
        if (timeoutMs !== undefined) {
          timer = setTimeout(() => {
            timedOut = true;
            if (child?.pid) killProcessGroup(child.pid);
          }, timeoutMs);
        }
        child.stdout?.on("data", onData);
        child.stderr?.on("data", onData);

        const exitCode = await waitForChildProcess(child);
        cleanupTerminationHandlers();

        const violationStore = SandboxManager.getSandboxViolationStore();
        await waitForSandboxViolationDelivery(commandId, violationStore);
        const annotation = sandboxViolationAnnotation(commandId, violationStore);
        if (annotation && reportViolation) {
          try {
            reportViolation(annotation);
          } catch {
            // Diagnostics must not change command execution semantics.
          }
        }

        if (signal?.aborted) throw new Error("aborted");
        if (timedOut) throw new Error(`timeout:${timeout}`);
        return { exitCode };
      } finally {
        cleanupTerminationHandlers();
        SandboxManager.cleanupAfterCommand();
      }
    },
  };
}
