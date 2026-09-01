import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {
  macGetMandatoryDenyPatterns,
  wrapCommandWithSandboxMacOS,
} from "@anthropic-ai/sandbox-runtime/dist/sandbox/macos-sandbox-utils.js";

const AF_SYSTEM_RULE =
  "(allow system-socket (require-all (socket-domain AF_SYSTEM) (socket-protocol 2)))";
const AF_ROUTE_RULE = "(allow system-socket (socket-domain AF_ROUTE))";
const KEYCHAIN_MACH_SERVICES = [
  "com.apple.securityd.xpc",
  "com.apple.SecurityServer",
  "com.apple.secd",
] as const;
const GLOBAL_IPC_GRANTS = [
  "(allow ipc-posix-shm)",
  "(allow ipc-posix-sem)",
  "(allow distributed-notification-post)",
  "com.apple.distributed_notifications",
  "com.apple.system.notification_center",
] as const;

const DANGEROUS_FILES = [
  ".gitconfig",
  ".gitmodules",
  ".bashrc",
  ".bash_profile",
  ".zshrc",
  ".zprofile",
  ".profile",
  ".ripgreprc",
  ".mcp.json",
] as const;
const DANGEROUS_DIRECTORIES = [
  ".vscode",
  ".idea",
  ".claude/commands",
  ".claude/agents",
  ".git/hooks",
] as const;

test("restricted macOS profiles allow only the required safe system sockets", () => {
  // Profile generation is pure string construction and can be checked on any host.
  const wrappedCommand = wrapCommandWithSandboxMacOS({
    command: "true",
    needsNetworkRestriction: true,
  });

  assert.ok(wrappedCommand.includes(`${AF_SYSTEM_RULE}\n${AF_ROUTE_RULE}`));
  assert.equal(wrappedCommand.split(AF_ROUTE_RULE).length - 1, 1);
  assert.equal(wrappedCommand.includes("(allow system-socket)"), false);
  assert.equal(wrappedCommand.includes("(allow network*)"), false);
});

test("every restricted macOS profile denies by default without global IPC grants", () => {
  const profiles = [
    wrapCommandWithSandboxMacOS({
      command: "true",
      needsNetworkRestriction: true,
    }),
    wrapCommandWithSandboxMacOS({
      command: "true",
      needsNetworkRestriction: false,
      readConfig: { denyOnly: ["/private/tmp/pi-f08-secret"], allowWithinDeny: [] },
    }),
    wrapCommandWithSandboxMacOS({
      command: "true",
      needsNetworkRestriction: false,
      writeConfig: { allowOnly: ["/private/tmp/pi-f08-work"], denyWithinAllow: [] },
    }),
    wrapCommandWithSandboxMacOS({
      command: "true",
      needsNetworkRestriction: true,
      readConfig: { denyOnly: ["/private/tmp/pi-f08-secret"], allowWithinDeny: [] },
      writeConfig: { allowOnly: ["/private/tmp/pi-f08-work"], denyWithinAllow: [] },
      allowMachLookup: ["com.example.safe-service", "com.example.safe-prefix.*"],
    }),
  ];

  for (const [index, wrappedCommand] of profiles.entries()) {
    assert.ok(wrappedCommand.includes("(deny default"), `profile ${index}`);
    for (const grant of GLOBAL_IPC_GRANTS) {
      assert.equal(wrappedCommand.includes(grant), false, `profile ${index}: ${grant}`);
    }
  }
});

test("default macOS profiles do not grant Keychain Mach services", () => {
  const wrappedCommand = wrapCommandWithSandboxMacOS({
    command: "true",
    needsNetworkRestriction: true,
  });

  for (const service of KEYCHAIN_MACH_SERVICES) {
    assert.equal(wrappedCommand.includes(service), false, service);
  }
});

test("allowMachLookup can explicitly restore exact Keychain service grants", () => {
  const wrappedCommand = wrapCommandWithSandboxMacOS({
    command: "true",
    needsNetworkRestriction: true,
    allowMachLookup: [...KEYCHAIN_MACH_SERVICES],
  });

  assert.ok(wrappedCommand.includes("; User-specified XPC/Mach services"));
  for (const service of KEYCHAIN_MACH_SERVICES) {
    const exactRule = `(allow mach-lookup (global-name ${JSON.stringify(service)}))`;
    assert.equal(wrappedCommand.split(service).length - 1, 1, service);
    assert.equal(wrappedCommand.split(exactRule).length - 1, 1, exactRule);
  }
});

test("mandatory macOS denies use the effective child cwd and absolute recursive patterns", () => {
  const brokerCwd = process.cwd();
  const childCwd = path.join(path.parse(brokerCwd).root, "private", "tmp", "f02-child-root");
  assert.notEqual(childCwd, brokerCwd);

  const patterns = macGetMandatoryDenyPatterns(false, childCwd);
  for (const fileName of DANGEROUS_FILES) {
    assert.ok(patterns.includes(path.join(childCwd, fileName)));
    assert.ok(patterns.includes(`/**/${fileName}`));
    assert.equal(patterns.includes(path.join(brokerCwd, fileName)), false);
  }
  for (const directory of DANGEROUS_DIRECTORIES) {
    assert.ok(patterns.includes(path.join(childCwd, directory)));
    assert.ok(patterns.includes(`/**/${directory}`));
    assert.equal(patterns.includes(`/**/${directory}/**`), false);
  }
  assert.ok(patterns.includes(path.join(childCwd, ".git/config")));
  assert.ok(patterns.includes("/**/.git/config"));
});

test("mandatory directory patterns protect their vnode and subtree without trailing globs", () => {
  const childCwd = "/private/tmp/f02-directory-node";
  const wrappedCommand = wrapCommandWithSandboxMacOS({
    command: "true",
    needsNetworkRestriction: false,
    readConfig: undefined,
    writeConfig: { allowOnly: [childCwd], denyWithinAllow: [] },
    effectiveCwd: childCwd,
  });

  for (const directory of DANGEROUS_DIRECTORIES) {
    assert.ok(
      macGetMandatoryDenyPatterns(false, childCwd).includes(`/**/${directory}`),
    );
  }
  assert.ok(wrappedCommand.includes(`(subpath ${JSON.stringify(path.join(childCwd, ".vscode"))})`));
  // denyPathFilter extends glob matches with an optional /... tail.
  assert.ok(wrappedCommand.includes('(regex "^/(.*/)?\\\\.vscode(/.*)?$")'));
});

test("allowGitConfig removes only Git config from the mandatory deny set", () => {
  const childCwd = "/private/tmp/f02-allow-git-config";
  const denied = macGetMandatoryDenyPatterns(false, childCwd);
  const allowed = macGetMandatoryDenyPatterns(true, childCwd);

  assert.ok(denied.includes(path.join(childCwd, ".git/config")));
  assert.ok(denied.includes("/**/.git/config"));
  assert.equal(allowed.includes(path.join(childCwd, ".git/config")), false);
  assert.equal(allowed.includes("/**/.git/config"), false);
  assert.ok(allowed.includes(path.join(childCwd, ".git/hooks")));
  assert.ok(allowed.includes("/**/.git/hooks"));
});

test("direct macOS wrappers default mandatory root paths to process.cwd", () => {
  const patterns = macGetMandatoryDenyPatterns();
  assert.ok(patterns.includes(path.join(process.cwd(), ".gitconfig")));

  const wrappedCommand = wrapCommandWithSandboxMacOS({
    command: "true",
    needsNetworkRestriction: false,
    readConfig: undefined,
    writeConfig: { allowOnly: [process.cwd()], denyWithinAllow: [] },
  });
  assert.ok(
    wrappedCommand.includes(
      `(subpath ${JSON.stringify(path.join(process.cwd(), ".gitconfig"))})`,
    ),
  );
});
