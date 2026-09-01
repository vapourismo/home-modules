import type { ChildProcess } from "node:child_process";

const EXIT_STDIO_GRACE_MILLISECONDS = 100;

/**
 * Wait for the primary process without allowing quiet descendants that inherit
 * its output pipes to keep the wait open indefinitely.
 */
export function waitForChildProcess(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let exited = false;
    let exitCode: number | null = null;
    let postExitTimer: NodeJS.Timeout | undefined;
    let stdoutEnded = child.stdout === null;
    let stderrEnded = child.stderr === null;

    const cleanup = (): void => {
      if (postExitTimer) clearTimeout(postExitTimer);
      child.removeListener("error", onError);
      child.removeListener("exit", onExit);
      child.removeListener("close", onClose);
      child.stdout?.removeListener("end", onStdoutEnd);
      child.stderr?.removeListener("end", onStderrEnd);
      child.stdout?.removeListener("data", onData);
      child.stderr?.removeListener("data", onData);
    };
    const finalize = (code: number | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      child.stdout?.destroy();
      child.stderr?.destroy();
      resolve(code);
    };
    const maybeFinalizeAfterExit = (): void => {
      if (exited && stdoutEnded && stderrEnded) finalize(exitCode);
    };
    const armIdleTimer = (): void => {
      if (postExitTimer) clearTimeout(postExitTimer);
      postExitTimer = setTimeout(() => finalize(exitCode), EXIT_STDIO_GRACE_MILLISECONDS);
    };
    const onData = (): void => {
      if (exited && !settled) armIdleTimer();
    };
    const onStdoutEnd = (): void => {
      stdoutEnded = true;
      maybeFinalizeAfterExit();
    };
    const onStderrEnd = (): void => {
      stderrEnded = true;
      maybeFinalizeAfterExit();
    };
    const onError = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null): void => {
      exited = true;
      exitCode = code;
      maybeFinalizeAfterExit();
      if (!settled) armIdleTimer();
    };
    const onClose = (code: number | null): void => finalize(code);

    child.stdout?.once("end", onStdoutEnd);
    child.stderr?.once("end", onStderrEnd);
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("error", onError);
    child.once("exit", onExit);
    child.once("close", onClose);
  });
}
