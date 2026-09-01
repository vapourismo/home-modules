import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";

const IS_MACOS = process.platform === "darwin";
const SECURITY = "/usr/bin/security";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function runSecurity(args: string[]) {
  return spawnSync(SECURITY, args, {
    encoding: "utf8",
    timeout: 20_000,
  });
}

function spawnFailure(result: ReturnType<typeof spawnSync>): string {
  return [
    `status=${result.status}`,
    `signal=${result.signal}`,
    `error=${result.error?.message ?? ""}`,
    `stdout=${String(result.stdout)}`,
    `stderr=${String(result.stderr)}`,
  ].join("\n");
}

function assertSuccess(
  result: ReturnType<typeof runSecurity>,
  operation: string,
): void {
  assert.equal(result.status, 0, `${operation}\n${spawnFailure(result)}`);
}

function runtimeConfig(keychainPath: string, writeRoot: string): any {
  return {
    network: { deniedDomains: [], httpProxyPort: 9, socksProxyPort: 9 },
    filesystem: {
      denyRead: [keychainPath],
      allowRead: [],
      allowWrite: [writeRoot],
      denyWrite: [],
    },
  };
}

async function spawnSandboxed(args: string[], cwd: string) {
  const command = [SECURITY, ...args].map(shellQuote).join(" ");
  const wrapped = await SandboxManager.wrapWithSandboxArgv(
    command,
    undefined,
    undefined,
    undefined,
    cwd,
  );
  return spawnSync(wrapped.argv[0]!, wrapped.argv.slice(1), {
    cwd,
    env: wrapped.env,
    encoding: "utf8",
    timeout: 20_000,
  });
}

async function spawnSandboxedShell(command: string, cwd: string) {
  const wrapped = await SandboxManager.wrapWithSandboxArgv(
    command,
    undefined,
    undefined,
    undefined,
    cwd,
  );
  return spawnSync(wrapped.argv[0]!, wrapped.argv.slice(1), {
    cwd,
    env: wrapped.env,
    encoding: "utf8",
    timeout: 20_000,
  });
}

function assertNoMarkers(
  result: ReturnType<typeof spawnSync>,
  markers: readonly string[],
  operation: string,
): void {
  const output = `${String(result.stdout)}\n${String(result.stderr)}`;
  for (const marker of markers) {
    assert.equal(
      output.includes(marker),
      false,
      `${operation} emitted ${marker}\n${spawnFailure(result)}`,
    );
  }
}

test("default macOS profile blocks synthetic Keychain broker access", {
  skip: !IS_MACOS,
  concurrency: false,
  timeout: 120_000,
}, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-f05-keychain-"));
  const keychainPath = path.join(root, "synthetic.keychain-db");
  const suffix = randomUUID();
  const password = `f05-password-${suffix}`;
  const account = `f05-account-${suffix}`;
  const service = `f05-service-${suffix}`;
  const secret = `f05-secret-${suffix}`;
  const markers = [account, service, secret] as const;
  let initialized = false;

  try {
    const create = runSecurity(["create-keychain", "-p", password, keychainPath]);
    if (
      create.status !== 0
      && (process.env.SANDBOX_RUNTIME === "1" || process.env.NIX_BUILD_TOP !== undefined)
    ) {
      t.skip(
        `the parent sandbox does not permit synthetic Keychain setup: ${String(create.stderr).trim()}`,
      );
      return;
    }
    assertSuccess(create, "create synthetic keychain");

    assertSuccess(
      runSecurity(["unlock-keychain", "-p", password, keychainPath]),
      "unlock synthetic keychain",
    );
    // -A makes plaintext retrieval deliberately noninteractive. This is safe
    // only because the keychain and secret are disposable synthetic fixtures.
    assertSuccess(
      runSecurity([
        "add-generic-password",
        "-a", account,
        "-s", service,
        "-w", secret,
        "-A",
        keychainPath,
      ]),
      "add synthetic keychain item",
    );

    const dumpVariants = [
      { label: "metadata dump", args: ["dump-keychain", keychainPath] },
      { label: "ACL dump", args: ["dump-keychain", "-a", keychainPath] },
      { label: "raw dump", args: ["dump-keychain", "-r", keychainPath] },
    ];
    for (const variant of dumpVariants) {
      const control = runSecurity(variant.args);
      assertSuccess(control, `outside-profile ${variant.label}`);
      const output = `${String(control.stdout)}\n${String(control.stderr)}`;
      assert.ok(
        output.includes(account),
        `${variant.label} omitted the fixture account`,
      );
      assert.ok(
        output.includes(service),
        `${variant.label} omitted the fixture service`,
      );
    }

    const plaintextControl = runSecurity([
      "find-generic-password",
      "-a", account,
      "-s", service,
      "-w",
      keychainPath,
    ]);
    assertSuccess(plaintextControl, "outside-profile plaintext retrieval");
    assert.equal(String(plaintextControl.stdout).trim(), secret);

    await SandboxManager.initialize(runtimeConfig(keychainPath, root));
    initialized = true;

    const sandboxControl = await spawnSandboxedShell("true", root);
    if (
      sandboxControl.status === 71
      && /sandbox_apply: Operation not permitted/.test(String(sandboxControl.stderr))
    ) {
      t.skip("the parent Seatbelt profile does not permit a nested sandbox-exec");
      return;
    }
    assert.equal(sandboxControl.status, 0, spawnFailure(sandboxControl));

    const directRead = await spawnSandboxedShell(
      `/bin/cat ${shellQuote(keychainPath)} > /dev/null`,
      root,
    );
    assert.notEqual(
      directRead.status,
      0,
      `direct keychain read unexpectedly succeeded\n${spawnFailure(directRead)}`,
    );

    for (const variant of dumpVariants) {
      const result = await spawnSandboxed(variant.args, root);
      // security(1) can report an inaccessible explicit keychain as a
      // successful empty dump, so absence of every controlled marker is the
      // enforcement assertion rather than its process exit status.
      assertNoMarkers(result, markers, variant.label);
    }

    const plaintext = await spawnSandboxed([
      "find-generic-password",
      "-a", account,
      "-s", service,
      "-w",
      keychainPath,
    ], root);
    assert.notEqual(
      plaintext.status,
      0,
      `plaintext retrieval unexpectedly succeeded\n${spawnFailure(plaintext)}`,
    );
    assertNoMarkers(plaintext, [secret], "plaintext retrieval");
  } finally {
    if (initialized) await SandboxManager.reset();
    runSecurity(["delete-keychain", keychainPath]);
    await rm(root, { recursive: true, force: true });
  }
});
