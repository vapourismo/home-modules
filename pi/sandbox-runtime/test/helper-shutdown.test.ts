import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { type TestContext } from "node:test";
import { HelperRpcClient } from "../src/rpc.ts";

const HELPER_PATH = fileURLToPath(new URL("../helper.mjs", import.meta.url));

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error && typeof error === "object" && "code" in error && error.code === "ESRCH");
  }
}

function killProcessGroup(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try { process.kill(pid, "SIGKILL"); } catch {}
  }
}

async function waitForRecordedPid(pidPath: string): Promise<number> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      const pid = Number.parseInt(await readFile(pidPath, "utf8"), 10);
      if (Number.isSafeInteger(pid) && pid > 0) return pid;
    } catch {}
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for the fake search process PID");
}

async function waitForProcessToStop(pid: number): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (isProcessAlive(pid) && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(isProcessAlive(pid), false, `process ${pid} should have stopped`);
}

async function createActiveFindHarness(t: TestContext, onUnexpectedExit?: (error: Error) => void) {
  const root = await mkdtemp(path.join(tmpdir(), "pi-helper-shutdown-"));
  const binDir = path.join(root, "bin");
  const pidPath = path.join(root, "search.pid");
  await mkdir(binDir);
  const fdPath = path.join(binDir, "fd");
  await writeFile(fdPath, `#!${process.execPath}
const fs = require("node:fs");
fs.writeFileSync(process.env.FAKE_SEARCH_PID_FILE, String(process.pid));
process.on("SIGTERM", () => {});
setInterval(() => {}, 1000);
`);
  await chmod(fdPath, 0o755);

  const child = spawn(process.execPath, [HELPER_PATH], {
    cwd: root,
    env: { ...process.env, PATH: binDir, FAKE_SEARCH_PID_FILE: pidPath },
    detached: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.on("data", () => {});
  const rpc = new HelperRpcClient(child, onUnexpectedExit);
  let searchPid: number | undefined;

  t.after(async () => {
    await rpc.close().catch(() => {});
    if (child.pid && isProcessAlive(child.pid)) killProcessGroup(child.pid);
    if (!searchPid) {
      try { searchPid = await waitForRecordedPid(pidPath); } catch {}
    }
    if (searchPid && isProcessAlive(searchPid)) killProcessGroup(searchPid);
    await rm(root, { recursive: true, force: true });
  });

  await rpc.request("probe", {});
  const findOutcome = rpc.request("find", { path: root, pattern: "hold" }).then(
    (result) => ({ result, error: undefined }),
    (error: Error) => ({ result: undefined, error }),
  );
  searchPid = await waitForRecordedPid(pidPath);
  assert.equal(isProcessAlive(searchPid), true);

  return { child, findOutcome, rpc, searchPid };
}

test("graceful client close lets the helper kill an active detached search", async (t) => {
  const unexpected: Error[] = [];
  const { child, findOutcome, rpc, searchPid } = await createActiveFindHarness(
    t,
    (error) => unexpected.push(error),
  );
  const helperPid = child.pid!;
  const reason = new Error("test helper shutdown");

  const shutdown = rpc.close(reason);
  assert.equal(rpc.isClosed, true);
  const outcome = await findOutcome;
  assert.strictEqual(outcome.error, reason);
  await shutdown;

  await Promise.all([
    waitForProcessToStop(helperPid),
    waitForProcessToStop(searchPid),
  ]);
  assert.equal(unexpected.length, 0);
});

test("client protocol failure lets the helper kill an active detached search", async (t) => {
  const unexpected: Error[] = [];
  const { child, findOutcome, rpc, searchPid } = await createActiveFindHarness(
    t,
    (error) => unexpected.push(error),
  );
  const helperPid = child.pid!;

  child.stdout.emit("data", Buffer.from("not json\n"));
  assert.equal(rpc.isClosed, true);
  const shutdown = rpc.close();
  const outcome = await findOutcome;
  assert.match(outcome.error?.message ?? "", /malformed RPC JSON/);
  await shutdown;

  await Promise.all([
    waitForProcessToStop(helperPid),
    waitForProcessToStop(searchPid),
  ]);
  assert.equal(unexpected.length, 1);
  assert.strictEqual(unexpected[0], outcome.error);
});
