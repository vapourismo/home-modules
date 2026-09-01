import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";

const IS_MACOS = process.platform === "darwin";

type ProcessResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function failure(result: ProcessResult | ReturnType<typeof spawnSync>): string {
  return [
    `status=${result.status}`,
    `signal=${result.signal}`,
    `error=${"error" in result ? result.error?.message ?? "" : ""}`,
    `stdout=${String(result.stdout)}`,
    `stderr=${String(result.stderr)}`,
  ].join("\n");
}

function runtimeConfig(writeRoot: string): any {
  return {
    network: { deniedDomains: [], httpProxyPort: 9, socksProxyPort: 9 },
    filesystem: {
      denyRead: [],
      allowRead: [],
      allowWrite: [writeRoot],
      denyWrite: [],
    },
  };
}

function waitForProcess(child: ChildProcessWithoutNullStreams): Promise<ProcessResult> {
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => { stdout += chunk; });
  child.stderr.on("data", (chunk: string) => { stderr += chunk; });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (status, signal) => resolve({ status, signal, stdout, stderr }));
  });
}

async function waitForFile(filePath: string, child: ChildProcessWithoutNullStreams): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await access(filePath);
      return;
    } catch {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`listener exited before becoming ready: ${filePath}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw new Error(`listener did not become ready: ${filePath}`);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sandboxCommand(args: string[], cwd: string) {
  const command = args.map(shellQuote).join(" ");
  const wrapped = await SandboxManager.wrapWithSandboxArgv(
    command,
    undefined,
    undefined,
    undefined,
    cwd,
  );
  return wrapped;
}

async function spawnSandboxedSync(args: string[], cwd: string) {
  const wrapped = await sandboxCommand(args, cwd);
  return spawnSync(wrapped.argv[0]!, wrapped.argv.slice(1), {
    cwd,
    env: wrapped.env,
    encoding: "utf8",
    timeout: 20_000,
  });
}

test("macOS profiles isolate global POSIX IPC and notification channels", {
  skip: !IS_MACOS,
  concurrency: false,
  timeout: 120_000,
}, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-f08-global-ipc-"));
  const source = fileURLToPath(new URL("fixtures/global-ipc-probe.c", import.meta.url));
  const probe = path.join(root, "global-ipc-probe");
  const activeChildren = new Set<ChildProcessWithoutNullStreams>();
  let initialized = false;

  const startHost = (args: string[]) => {
    const child = spawn(probe, args, { cwd: root });
    activeChildren.add(child);
    const result = waitForProcess(child).finally(() => activeChildren.delete(child));
    return { child, result };
  };

  const startSandboxed = async (args: string[]) => {
    const wrapped = await sandboxCommand([probe, ...args], root);
    const child = spawn(wrapped.argv[0]!, wrapped.argv.slice(1), {
      cwd: root,
      env: wrapped.env,
    });
    activeChildren.add(child);
    const result = waitForProcess(child).finally(() => activeChildren.delete(child));
    return { child, result };
  };

  const runNotificationCase = async (
    center: "distributed" | "darwin",
    listenerSandboxed: boolean,
    posterSandboxed: boolean,
    expectDelivery: boolean,
    label: string,
  ) => {
    const suffix = `${center}-${label}-${randomUUID()}`;
    const name = `org.pi-sandbox.f08.${suffix}`;
    const ready = path.join(root, `${suffix}.ready`);
    const received = path.join(root, `${suffix}.received`);
    const listener = listenerSandboxed
      ? await startSandboxed(["listen", center, name, ready, received, "2"])
      : startHost(["listen", center, name, ready, received, "2"]);
    await waitForFile(ready, listener.child);

    const post = posterSandboxed
      ? await spawnSandboxedSync([probe, "post", center, name], root)
      : spawnSync(probe, ["post", center, name], {
        cwd: root,
        encoding: "utf8",
        timeout: 20_000,
      });
    if (!posterSandboxed) {
      assert.equal(post.status, 0, `${label} host post\n${failure(post)}`);
    }

    const listenerResult = await listener.result;
    assert.equal(
      await fileExists(received),
      expectDelivery,
      `${label}\nposter:\n${failure(post)}\nlistener:\n${failure(listenerResult)}`,
    );
    assert.equal(
      listenerResult.status,
      expectDelivery ? 0 : 3,
      `${label}\n${failure(listenerResult)}`,
    );
  };

  try {
    const compile = spawnSync("clang", [source, "-framework", "CoreFoundation", "-o", probe], {
      cwd: root,
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.equal(compile.status, 0, `compile notification probe\n${failure(compile)}`);

    await SandboxManager.initialize(runtimeConfig(root));
    initialized = true;

    const sandboxControl = await spawnSandboxedSync(["/usr/bin/true"], root);
    if (
      sandboxControl.status === 71
      && /sandbox_apply: Operation not permitted/.test(String(sandboxControl.stderr))
    ) {
      t.skip("the parent Seatbelt profile does not permit a nested sandbox-exec");
      return;
    }
    assert.equal(sandboxControl.status, 0, failure(sandboxControl));

    for (const kind of ["shm", "sem"] as const) {
      // Darwin limits POSIX IPC names to 31 characters including the slash.
      const nonce = () => randomUUID().replaceAll("-", "").slice(0, 16);
      const createName = `/pf08${kind[1]}c${nonce()}`;
      const create = await spawnSandboxedSync([probe, `${kind}-create`, createName], root);
      assert.notEqual(create.status, 0, `sandboxed ${kind} creation succeeded\n${failure(create)}`);
      assert.match(String(create.stderr), /Operation not permitted/);
      const absent = spawnSync(probe, [`${kind}-open`, createName], {
        cwd: root,
        encoding: "utf8",
      });
      assert.notEqual(absent.status, 0, `sandboxed ${kind} creation left a host object`);

      const hostName = `/pf08${kind[1]}h${nonce()}`;
      const hostCreate = spawnSync(probe, [`${kind}-create`, hostName], {
        cwd: root,
        encoding: "utf8",
      });
      assert.equal(hostCreate.status, 0, `host ${kind} creation\n${failure(hostCreate)}`);
      try {
        const open = await spawnSandboxedSync([probe, `${kind}-open`, hostName], root);
        assert.notEqual(open.status, 0, `sandboxed ${kind} open succeeded\n${failure(open)}`);
        assert.match(String(open.stderr), /Operation not permitted/);

        const unlink = await spawnSandboxedSync([probe, `${kind}-unlink`, hostName], root);
        assert.notEqual(unlink.status, 0, `sandboxed ${kind} unlink succeeded\n${failure(unlink)}`);
        assert.match(String(unlink.stderr), /Operation not permitted/);

        const stillPresent = spawnSync(probe, [`${kind}-open`, hostName], {
          cwd: root,
          encoding: "utf8",
        });
        assert.equal(stillPresent.status, 0, `sandboxed unlink removed host ${kind}`);
      } finally {
        spawnSync(probe, [`${kind}-unlink`, hostName], { cwd: root, encoding: "utf8" });
      }
    }

    for (const center of ["distributed", "darwin"] as const) {
      await runNotificationCase(center, false, false, true, `${center}-host-control`);
      await runNotificationCase(center, false, true, false, `${center}-sandbox-to-host`);
      await runNotificationCase(center, true, false, false, `${center}-host-to-sandbox`);
      await runNotificationCase(center, true, true, false, `${center}-cross-invocation`);
    }

    const python = await spawnSandboxedSync([
      "python3",
      "-c",
      "print('pi-f08-python-smoke')",
    ], root);
    assert.equal(python.status, 0, `basic Python smoke\n${failure(python)}`);
    assert.match(String(python.stdout), /pi-f08-python-smoke/);

    const foundation = await spawnSandboxedSync([probe, "foundation-smoke"], root);
    assert.equal(foundation.status, 0, `Foundation-linked smoke\n${failure(foundation)}`);
  } finally {
    for (const child of activeChildren) child.kill("SIGKILL");
    if (initialized) await SandboxManager.reset();
    await rm(root, { recursive: true, force: true });
  }
});
