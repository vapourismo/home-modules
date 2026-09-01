import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadPolicy, mergePolicyObjects, validatePolicy } from "../src/config.ts";

const minimal = {
  enabled: true,
  network: { allowedDomains: [], deniedDomains: [] },
  filesystem: { denyRead: [], allowRead: [], allowWrite: ["."], denyWrite: [] },
};

test("recursive merge adds and deduplicates arrays while project scalars win", () => {
  const merged = mergePolicyObjects(
    {
      enabled: true,
      network: { allowedDomains: ["github.com"], deniedDomains: [] },
      filesystem: { allowWrite: [".", "/tmp"] },
    },
    {
      enabled: false,
      network: { allowedDomains: ["github.com", "api.github.com"] },
      filesystem: { allowWrite: ["./generated"] },
    },
    true,
  ) as any;
  assert.equal(merged.enabled, false);
  assert.deepEqual(merged.network.allowedDomains, ["github.com", "api.github.com"]);
  assert.deepEqual(merged.filesystem.allowWrite, [".", "/tmp", "./generated"]);
});

test("untrusted project policy is not merged or read", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-config-"));
  const agentDir = path.join(root, "agent");
  const cwd = path.join(root, "project");
  await mkdir(path.join(cwd, ".pi"), { recursive: true });
  await mkdir(agentDir, { recursive: true });
  await writeFile(path.join(agentDir, "sandbox.json"), JSON.stringify(minimal));
  await writeFile(path.join(cwd, ".pi", "sandbox.json"), "not json");

  const loaded = await loadPolicy({ agentDir, cwd, configDirName: ".pi", projectTrusted: false });
  assert.equal(loaded.config.enabled, true);
  assert.equal(loaded.sources.find((source) => source.scope === "project")?.ignored, true);
});

test("malformed JSON fails closed during loading", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-config-"));
  await mkdir(path.join(root, "agent"), { recursive: true });
  await writeFile(path.join(root, "agent", "sandbox.json"), "{");
  await assert.rejects(
    loadPolicy({ agentDir: path.join(root, "agent"), cwd: root, configDirName: ".pi", projectTrusted: false }),
    /Could not parse sandbox policy/,
  );
});

test("unknown and obsolete configuration keys are rejected", () => {
  assert.throws(() => validatePolicy({ ...minimal, mystery: true }), /Unknown sandbox configuration key/);
  assert.throws(
    () => validatePolicy({ ...minimal, network: { ...minimal.network, allowNetwork: false } }),
    /Unknown sandbox configuration key: configuration\.network\.allowNetwork/,
  );
});

test("Object prototype property names are rejected as top-level unknown keys", () => {
  for (const key of ["toString", "constructor", "__proto__"]) {
    const policy: Record<string, unknown> = { ...minimal };
    Object.defineProperty(policy, key, { value: true, enumerable: true });

    assert.throws(
      () => validatePolicy(policy),
      { message: `Unknown sandbox configuration key: configuration.${key}` },
    );
  }
});

test("JSON __proto__ payloads cannot change merged object prototypes", () => {
  const payload = JSON.parse('{"__proto__":{"polluted":true}}');
  const merged = mergePolicyObjects(payload, undefined, false) as Record<string, unknown>;

  assert.equal(Object.getPrototypeOf(merged), null);
  assert.equal(Object.hasOwn(merged, "__proto__"), true);
  assert.equal((merged.__proto__ as Record<string, unknown>).polluted, true);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.throws(
    () => validatePolicy(merged),
    { message: "Unknown sandbox configuration key: configuration.__proto__" },
  );
});

test("network strict allowlisting may be omitted and is enabled by default", () => {
  const omitted = validatePolicy(minimal);
  assert.equal(omitted.network.strictAllowlist, undefined);

  const defaults = validatePolicy(mergePolicyObjects(undefined, undefined, false));
  assert.equal(defaults.network.strictAllowlist, true);
});

test("explicit network strict allowlisting is accepted", () => {
  const strict = validatePolicy({
    ...minimal,
    network: { allowedDomains: ["github.com"], deniedDomains: [], strictAllowlist: true },
  });
  assert.equal(strict.network.strictAllowlist, true);
});

test("non-strict network allowlisting is rejected", () => {
  assert.throws(
    () => validatePolicy({
      ...minimal,
      network: { allowedDomains: ["github.com"], deniedDomains: [], strictAllowlist: false },
    }),
    /network\.strictAllowlist must be true or omitted; keep strict mode enabled and add required destinations to network\.allowedDomains/,
  );
});

test("notification broker Mach lookups are rejected", () => {
  const blocked = [
    "com.apple.distributed_notifications",
    "com.apple.distributed_notifications@Uv3",
    "com.apple.distributed_notifications@Uv4",
    "com.apple.distributed_notifications.custom",
    "com.apple.system.notification_center",
  ];

  for (const rule of blocked) {
    assert.throws(
      () => validatePolicy({
        ...minimal,
        network: { ...minimal.network, allowMachLookup: [rule] },
      }),
      (error: unknown) => error instanceof Error
        && error.message.includes("network.allowMachLookup.0")
        && error.message.includes(JSON.stringify(rule))
        && error.message.includes("blocked notification broker namespace"),
      rule,
    );
  }
});

test("Mach lookup wildcards intersecting notification brokers are rejected", () => {
  const blocked = [
    "*",
    "com.apple.*",
    "com.apple.distributed*",
    "com.apple.distributed_notifications*",
    "com.apple.distributed_notifications@Uv3*",
    "com.apple.system.*",
    "com.apple.system.notification_*",
    "com.apple.system.notification_center*",
  ];

  for (const rule of blocked) {
    assert.throws(
      () => validatePolicy({
        ...minimal,
        network: { ...minimal.network, allowMachLookup: [rule] },
      }),
      /global distributed and Darwin notification IPC cannot be enabled/,
      rule,
    );
  }
});

test("nearby non-notification Mach service allowlists remain valid", () => {
  const allowed = [
    "com.apple.distributed-notifications*",
    "com.apple.system.notification_centers*",
    "com.apple.system.notification_center.helper",
    "com.apple.system.notification_center.helper*",
    "com.example.notifications*",
  ];
  const policy = validatePolicy({
    ...minimal,
    network: { ...minimal.network, allowMachLookup: allowed },
  });
  assert.deepEqual(policy.network.allowMachLookup, allowed);
});

test("policy loading does not generate rules for secret-like environment variables", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-config-"));
  const agentDir = path.join(root, "agent");
  await mkdir(agentDir, { recursive: true });
  await writeFile(path.join(agentDir, "sandbox.json"), JSON.stringify(minimal));

  const names = ["PI_TEST_API_KEY", "PI_TEST_SESSION_TOKEN"] as const;
  const previous = names.map((name) => process.env[name]);
  process.env[names[0]] = "synthetic-api-key";
  process.env[names[1]] = "synthetic-session-token";
  try {
    const loaded = await loadPolicy({ agentDir, cwd: root, configDirName: ".pi", projectTrusted: false });
    assert.equal(loaded.runtimeConfig.credentials, undefined);
  } finally {
    for (const [index, name] of names.entries()) {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    }
  }
});

test("deny and mask environment credential entries are rejected", () => {
  for (const mode of ["deny", "mask"] as const) {
    assert.throws(
      () => validatePolicy({
        ...minimal,
        credentials: { envVars: [{ name: `PI_TEST_${mode.toUpperCase()}`, mode }] },
      }),
      /credentials\.envVars is unsupported.*sanitize Pi's launch environment/,
    );
  }
});

test("environment credential settings are rejected even when explicitly empty", () => {
  assert.throws(
    () => validatePolicy({ ...minimal, credentials: { envVars: [] } }),
    /credentials\.envVars is unsupported/,
  );
  assert.throws(
    () => validatePolicy({ ...minimal, credentials: { awsPairs: [] } }),
    /credentials\.awsPairs is unsupported/,
  );
  assert.throws(
    () => validatePolicy({ ...minimal, credentials: { sigv4: {} } }),
    /credentials\.sigv4 is unsupported/,
  );
});

test("merged global and project environment credential rules are rejected", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-config-"));
  const agentDir = path.join(root, "agent");
  const cwd = path.join(root, "project");
  await mkdir(agentDir, { recursive: true });
  await mkdir(path.join(cwd, ".pi"), { recursive: true });
  await writeFile(path.join(agentDir, "sandbox.json"), JSON.stringify({
    ...minimal,
    credentials: { envVars: [{ name: "PI_TEST_GLOBAL", mode: "deny" }] },
  }));
  await writeFile(path.join(cwd, ".pi", "sandbox.json"), JSON.stringify({
    credentials: { envVars: [{ name: "PI_TEST_PROJECT", mode: "mask" }] },
  }));

  await assert.rejects(
    loadPolicy({ agentDir, cwd, configDirName: ".pi", projectTrusted: true }),
    /credentials\.envVars is unsupported.*sanitize Pi's launch environment/,
  );
});

test("AWS environment credential settings are rejected rather than ignored", () => {
  assert.throws(
    () => validatePolicy({
      ...minimal,
      credentials: {
        awsPairs: [{ accessKeyIdVar: "AWS_ID", secretAccessKeyVar: "AWS_SECRET" }],
      },
    }),
    /credentials\.awsPairs is unsupported/,
  );
  assert.throws(
    () => validatePolicy({
      ...minimal,
      credentials: { sigv4: { streaming: "passthrough" } },
    }),
    /credentials\.sigv4 is unsupported/,
  );
});

test("credential-file configuration reaches the runtime config unchanged", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-sandbox-config-"));
  const agentDir = path.join(root, "agent");
  await mkdir(agentDir, { recursive: true });
  const credentials = {
    files: [{
      path: "~/.config/example/credentials",
      mode: "mask",
      extract: "token=(\\S+)",
      onExtractNoMatch: "deny",
      maskDuplicates: true,
      injectHosts: ["api.example.com"],
    }],
    allowPlaintextInject: true,
  };
  await writeFile(path.join(agentDir, "sandbox.json"), JSON.stringify({
    ...minimal,
    network: { allowedDomains: ["api.example.com"], deniedDomains: [] },
    credentials,
  }));

  const loaded = await loadPolicy({ agentDir, cwd: root, configDirName: ".pi", projectTrusted: false });
  assert.deepEqual(loaded.runtimeConfig.credentials, credentials);
});

test("invalid schema and enabled values are rejected", () => {
  assert.throws(() => validatePolicy({ ...minimal, enabled: "yes" }), /enabled must be a boolean/);
  assert.throws(
    () => validatePolicy({ ...minimal, network: { allowedDomains: "github.com", deniedDomains: [] } }),
    /Invalid sandbox configuration/,
  );
});
