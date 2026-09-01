import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";

const IS_MACOS = process.platform === "darwin";
const ORIGINAL = "ORIGINAL";
const MODIFIED = "MODIFIED";

const PROTECTED_PATHS = [
  { path: ".gitconfig", kind: "file" },
  { path: ".gitmodules", kind: "file" },
  { path: ".bashrc", kind: "file" },
  { path: ".bash_profile", kind: "file" },
  { path: ".zshrc", kind: "file" },
  { path: ".zprofile", kind: "file" },
  { path: ".profile", kind: "file" },
  { path: ".ripgreprc", kind: "file" },
  { path: ".mcp.json", kind: "file" },
  { path: ".vscode", kind: "directory", child: "settings.json" },
  { path: ".idea", kind: "directory", child: "workspace.xml" },
  { path: ".claude/commands", kind: "directory", child: "command.md" },
  { path: ".claude/agents", kind: "directory", child: "agent.md" },
  { path: ".git/hooks", kind: "directory", child: "pre-commit" },
  { path: ".git/config", kind: "file" },
] as const;

function runtimeConfig(writeRoot: string, options: {
  allowGitConfig?: boolean;
  disabled?: boolean;
} = {}): any {
  return {
    // Both external ports avoid starting an irrelevant local proxy in these
    // filesystem-only tests. allowedDomains is omitted, so no network policy
    // is included in wrapped commands.
    network: { deniedDomains: [], httpProxyPort: 9, socksProxyPort: 9 },
    filesystem: {
      disabled: options.disabled,
      denyRead: [],
      allowRead: [],
      allowWrite: [writeRoot],
      denyWrite: [],
      allowGitConfig: options.allowGitConfig,
    },
  };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function spawnSandboxed(command: string, cwd: string) {
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

function spawnFailure(result: ReturnType<typeof spawnSync>): string {
  return [
    `status=${result.status}`,
    `signal=${result.signal}`,
    `error=${result.error?.message ?? ""}`,
    `stdout=${String(result.stdout)}`,
    `stderr=${String(result.stderr)}`,
  ].join("\n");
}

async function prepareTarget(
  workspace: string,
  protectedPath: (typeof PROTECTED_PATHS)[number],
  location: "root" | "nested",
  state: "existing" | "absent",
): Promise<{ protectedNode: string; operationTarget: string }> {
  const project = location === "root"
    ? workspace
    : path.join(workspace, "nested", "project");
  const protectedNode = path.join(project, protectedPath.path);
  await mkdir(path.dirname(protectedNode), { recursive: true });

  if (state === "existing") {
    if (protectedPath.kind === "file") {
      await writeFile(protectedNode, ORIGINAL);
      return { protectedNode, operationTarget: protectedNode };
    }
    await mkdir(protectedNode, { recursive: true });
    const operationTarget = path.join(protectedNode, protectedPath.child);
    await writeFile(operationTarget, ORIGINAL);
    return { protectedNode, operationTarget };
  }

  return { protectedNode, operationTarget: protectedNode };
}

function spelledTarget(
  workspace: string,
  absoluteTarget: string,
  location: "root" | "nested",
  state: "existing" | "absent",
): string {
  const relative = path.relative(workspace, absoluteTarget);
  if (location === "root" && state === "existing") return relative;
  if (location === "root" && state === "absent") return `./${relative}`;
  if (location === "nested" && state === "existing") return absoluteTarget;
  const nestedRelative = path.relative(
    path.join(workspace, "nested", "project"),
    absoluteTarget,
  );
  return path.join("nested", "spelling", "..", "project", nestedRelative);
}

test("wrapWithSandboxArgv uses its child cwd for macOS mandatory profile roots", {
  skip: !IS_MACOS,
  concurrency: false,
}, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-f02-profile-"));
  const childCwd = path.join(root, "child");
  await mkdir(childCwd);
  try {
    await SandboxManager.initialize(runtimeConfig(root));
    const wrapped = await SandboxManager.wrapWithSandboxArgv(
      "true",
      undefined,
      undefined,
      undefined,
      childCwd,
    );
    const command = wrapped.argv[2]!;
    assert.ok(
      command.includes(`(subpath ${JSON.stringify(path.join(childCwd, ".gitconfig"))})`),
    );
    assert.equal(
      command.includes(`(subpath ${JSON.stringify(path.join(process.cwd(), ".gitconfig"))})`),
      false,
    );
  } finally {
    await SandboxManager.reset();
    await rm(root, { recursive: true, force: true });
  }
});

test("filesystem.disabled remains an explicit mandatory-deny escape hatch", {
  skip: !IS_MACOS,
  concurrency: false,
}, async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-f02-disabled-"));
  try {
    await SandboxManager.initialize(runtimeConfig(root, { disabled: true }));
    const wrapped = await SandboxManager.wrapWithSandboxArgv(
      "true",
      undefined,
      undefined,
      undefined,
      root,
    );
    assert.deepEqual(wrapped.argv, ["/bin/bash", "-c", "true"]);
  } finally {
    await SandboxManager.reset();
    await rm(root, { recursive: true, force: true });
  }
});

test("production macOS wrapper denies every mandatory dangerous path and bypass spelling", {
  skip: !IS_MACOS,
  concurrency: false,
  timeout: 180_000,
}, async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pi-f02-integration-"));
  let initialized = false;

  try {
    await SandboxManager.initialize(runtimeConfig(root));
    initialized = true;

    const controlRoot = path.join(root, "control");
    await mkdir(controlRoot);
    const control = await spawnSandboxed("printf STARTED > safe-control", controlRoot);
    if (
      control.status === 71
      && /sandbox_apply: Operation not permitted/.test(String(control.stderr))
    ) {
      t.skip("the parent Seatbelt profile does not permit a nested sandbox-exec");
      return;
    }
    assert.equal(control.status, 0, spawnFailure(control));
    assert.equal(await readFile(path.join(controlRoot, "safe-control"), "utf8"), "STARTED");

    let sequence = 0;
    for (const protectedPath of PROTECTED_PATHS) {
      for (const location of ["root", "nested"] as const) {
        for (const state of ["existing", "absent"] as const) {
          const workspace = path.join(root, `case-${sequence++}`);
          await mkdir(path.join(workspace, "nested", "spelling"), { recursive: true });
          const { protectedNode, operationTarget } = await prepareTarget(
            workspace,
            protectedPath,
            location,
            state,
          );
          const spelling = spelledTarget(workspace, operationTarget, location, state);
          const outcome = path.join(workspace, "outcome");
          const started = path.join(workspace, "started");
          const operation = state === "absent" && protectedPath.kind === "directory"
            ? `mkdir -- ${shellQuote(spelling)}`
            : `printf ${shellQuote(MODIFIED)} > ${shellQuote(spelling)}`;
          const command = [
            `printf STARTED > ${shellQuote(started)}`,
            `if ${operation}; then printf ALLOWED > ${shellQuote(outcome)}; else printf DENIED > ${shellQuote(outcome)}; fi`,
            "exit 0",
          ].join("; ");

          const result = await spawnSandboxed(command, workspace);
          const label = `${protectedPath.path} (${location}, ${state}, ${spelling})`;
          assert.equal(result.status, 0, `${label}\n${spawnFailure(result)}`);
          assert.equal(await readFile(started, "utf8"), "STARTED", label);
          assert.equal(await readFile(outcome, "utf8"), "DENIED", label);
          if (state === "existing") {
            assert.equal(await readFile(operationTarget, "utf8"), ORIGINAL, label);
          } else {
            assert.equal(await pathExists(protectedNode), false, label);
          }
        }
      }
    }

    const aliasRoot = path.join(root, "aliases");
    await mkdir(path.join(aliasRoot, ".vscode"), { recursive: true });
    await writeFile(path.join(aliasRoot, ".zshrc"), ORIGINAL);
    await writeFile(path.join(aliasRoot, ".vscode", "settings.json"), ORIGINAL);
    await symlink(".zshrc", path.join(aliasRoot, "file-alias"));
    await symlink(".vscode", path.join(aliasRoot, "directory-alias"));
    const aliasResult = await spawnSandboxed([
      "printf STARTED > alias-started",
      "if printf MODIFIED > file-alias; then printf ALLOWED > file-outcome; else printf DENIED > file-outcome; fi",
      "if printf MODIFIED > directory-alias/settings.json; then printf ALLOWED > directory-outcome; else printf DENIED > directory-outcome; fi",
      "exit 0",
    ].join("; "), aliasRoot);
    assert.equal(aliasResult.status, 0, spawnFailure(aliasResult));
    assert.equal(await readFile(path.join(aliasRoot, "alias-started"), "utf8"), "STARTED");
    assert.equal(await readFile(path.join(aliasRoot, "file-outcome"), "utf8"), "DENIED");
    assert.equal(await readFile(path.join(aliasRoot, "directory-outcome"), "utf8"), "DENIED");
    assert.equal(await readFile(path.join(aliasRoot, ".zshrc"), "utf8"), ORIGINAL);
    assert.equal(
      await readFile(path.join(aliasRoot, ".vscode", "settings.json"), "utf8"),
      ORIGINAL,
    );

    const renameRoot = path.join(root, "rename-swap");
    await mkdir(path.join(renameRoot, ".idea"), { recursive: true });
    await mkdir(path.join(renameRoot, ".claude"), { recursive: true });
    await mkdir(path.join(renameRoot, "staged-agents"), { recursive: true });
    await mkdir(path.join(renameRoot, "staged-vscode"), { recursive: true });
    await writeFile(path.join(renameRoot, ".idea", "workspace.xml"), ORIGINAL);
    const renameResult = await spawnSandboxed([
      "printf STARTED > rename-started",
      "if mv .idea moved-idea; then printf ALLOWED > rename-outcome; else printf DENIED > rename-outcome; fi",
      "if mv staged-agents .claude/agents; then printf ALLOWED > agents-outcome; else printf DENIED > agents-outcome; fi",
      "if mv staged-vscode .vscode; then printf ALLOWED > vscode-outcome; else printf DENIED > vscode-outcome; fi",
      "exit 0",
    ].join("; "), renameRoot);
    assert.equal(renameResult.status, 0, spawnFailure(renameResult));
    for (const name of ["rename-outcome", "agents-outcome", "vscode-outcome"]) {
      assert.equal(await readFile(path.join(renameRoot, name), "utf8"), "DENIED", name);
    }
    assert.equal(
      await readFile(path.join(renameRoot, ".idea", "workspace.xml"), "utf8"),
      ORIGINAL,
    );
    assert.equal(await pathExists(path.join(renameRoot, "moved-idea")), false);
    assert.equal(await pathExists(path.join(renameRoot, ".claude", "agents")), false);
    assert.equal(await pathExists(path.join(renameRoot, ".vscode")), false);
    assert.equal(await pathExists(path.join(renameRoot, "staged-agents")), true);
    assert.equal(await pathExists(path.join(renameRoot, "staged-vscode")), true);

    const openatRoot = path.join(root, "openat");
    await mkdir(openatRoot);
    await writeFile(path.join(openatRoot, ".mcp.json"), ORIGINAL);
    const probeSource = fileURLToPath(new URL("fixtures/openat-write.c", import.meta.url));
    const probePath = path.join(openatRoot, "openat-write");
    const compile = spawnSync("/usr/bin/clang", [probeSource, "-o", probePath], {
      encoding: "utf8",
      timeout: 20_000,
    });
    assert.equal(compile.status, 0, spawnFailure(compile));
    const openatResult = await spawnSandboxed([
      "printf STARTED > openat-started",
      `${shellQuote(probePath)} . .mcp.json`,
      "printf '%s' $? > openat-outcome",
      "exit 0",
    ].join("; "), openatRoot);
    assert.equal(openatResult.status, 0, spawnFailure(openatResult));
    assert.equal(await readFile(path.join(openatRoot, "openat-started"), "utf8"), "STARTED");
    assert.equal(await readFile(path.join(openatRoot, "openat-outcome"), "utf8"), "77");
    assert.equal(await readFile(path.join(openatRoot, ".mcp.json"), "utf8"), ORIGINAL);

    await SandboxManager.reset();
    initialized = false;
    await SandboxManager.initialize(runtimeConfig(root, { allowGitConfig: true }));
    initialized = true;
    const gitRoot = path.join(root, "allow-git-config");
    await mkdir(path.join(gitRoot, ".git", "hooks"), { recursive: true });
    await writeFile(path.join(gitRoot, ".git", "config"), ORIGINAL);
    await writeFile(path.join(gitRoot, ".git", "hooks", "pre-commit"), ORIGINAL);
    const gitResult = await spawnSandboxed([
      "printf STARTED > git-started",
      "if printf MODIFIED > .git/config; then printf ALLOWED > config-outcome; else printf DENIED > config-outcome; fi",
      "if printf MODIFIED > .git/hooks/pre-commit; then printf ALLOWED > hooks-outcome; else printf DENIED > hooks-outcome; fi",
      "exit 0",
    ].join("; "), gitRoot);
    assert.equal(gitResult.status, 0, spawnFailure(gitResult));
    assert.equal(await readFile(path.join(gitRoot, "git-started"), "utf8"), "STARTED");
    assert.equal(await readFile(path.join(gitRoot, "config-outcome"), "utf8"), "ALLOWED");
    assert.equal(await readFile(path.join(gitRoot, "hooks-outcome"), "utf8"), "DENIED");
    assert.equal(await readFile(path.join(gitRoot, ".git", "config"), "utf8"), MODIFIED);
    assert.equal(
      await readFile(path.join(gitRoot, ".git", "hooks", "pre-commit"), "utf8"),
      ORIGINAL,
    );
  } finally {
    if (initialized) await SandboxManager.reset();
    await rm(root, { recursive: true, force: true });
  }
});
