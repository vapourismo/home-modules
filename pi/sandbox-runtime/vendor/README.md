# Vendored Sandbox Runtime

`anthropic-ai-sandbox-runtime-0.0.75.tgz` is based on
`anthropic-experimental/sandbox-runtime` commit
`40804af269e1616092e9971de12a1f358f58eba9` (package version `0.0.75`). It has
four local source patches.

`allow-af-route.patch` adds this Seatbelt rule to every generated macOS profile:

```scheme
(allow system-socket (socket-domain AF_ROUTE))
```

This permits routing-table queries without relaxing network egress, proxy,
local-binding, domain-allowlist, or Unix-socket policy.

`dangerous-file-denials.patch` makes macOS mandatory write protections use the
child cwd passed to `SandboxManager.wrapWithSandboxArgv`, while deep/direct
profile callers continue to default to `process.cwd()`. Exact child-root paths
are paired with absolute recursive globs for dangerous files and directories.
Directory globs omit a trailing `/**` so the existing deny-subtree filter covers
both the directory vnode and its contents. `.git/hooks` remains unconditional;
`.git/config` is omitted only when `filesystem.allowGitConfig` is true.

`deny-global-posix-ipc.patch` removes the built-in `ipc-posix-shm` and
`ipc-posix-sem` grants, the `distributed-notification-post` grant, and Mach
lookups for `com.apple.distributed_notifications@Uv3` and
`com.apple.system.notification_center`. The profile's `deny default` therefore
blocks host-global named POSIX IPC, Foundation distributed notifications, and
Darwin notifyd. No replacement broker or namespace rewriting is included.

`deny-keychain-mach-services.patch` removes the profile's built-in Mach lookup
grants for `com.apple.securityd.xpc` and `com.apple.SecurityServer`.
`com.apple.secd` was not granted upstream and remains absent. The existing
`network.allowMachLookup` rendering is unchanged, so a trusted policy can still
restore exact service grants explicitly. The extension separately rejects Mach
lookup rules that intersect either blocked notification-broker namespace.

The package also differs from the official npm artifact in its bundled files.
It preserves the exact official Java proxy-agent JAR, but intentionally omits
the Linux seccomp `apply-seccomp` executables and Windows `srt-win.exe` runners
because this extension supports only macOS. The package version intentionally
remains `0.0.75`.

## Rebuilding

From the repository root:

```sh
repo_root="$PWD"
workdir="$(mktemp -d)"
mkdir -p "$workdir/official"

npm pack @anthropic-ai/sandbox-runtime@0.0.75 \
  --pack-destination "$workdir/official"
tar -xzf "$workdir/official/anthropic-ai-sandbox-runtime-0.0.75.tgz" \
  -C "$workdir/official" \
  package/vendor/java-proxy-agent/srt-proxy-agent.jar
proxy_agent_jar="$workdir/official/package/vendor/java-proxy-agent/srt-proxy-agent.jar"

test "$(wc -c < "$proxy_agent_jar" | tr -d '[:space:]')" = 12144
test "$(openssl dgst -sha256 -binary "$proxy_agent_jar" | openssl base64 -A)" = \
  "UGopldBV1cMEa1XJpRz5BenyT1NbzjnGG5tboJVUJPk="

jj git clone https://github.com/anthropic-experimental/sandbox-runtime.git \
  "$workdir/sandbox-runtime"
cd "$workdir/sandbox-runtime"
jj new 40804af269e1616092e9971de12a1f358f58eba9
patch -p1 < "$repo_root/pi/sandbox-runtime/vendor/allow-af-route.patch"
patch -p1 < \
  "$repo_root/pi/sandbox-runtime/vendor/dangerous-file-denials.patch"
patch -p1 < \
  "$repo_root/pi/sandbox-runtime/vendor/deny-global-posix-ipc.patch"
patch -p1 < \
  "$repo_root/pi/sandbox-runtime/vendor/deny-keychain-mach-services.patch"
npm ci --ignore-scripts
install -m 0644 "$proxy_agent_jar" \
  vendor/java-proxy-agent/srt-proxy-agent.jar
npm run build
npm pack
cp anthropic-ai-sandbox-runtime-0.0.75.tgz \
  "$repo_root/pi/sandbox-runtime/vendor/anthropic-ai-sandbox-runtime-0.0.75.tgz"
```

Refresh the tarball's SHA-512 `integrity` in `../package-lock.json` from:

```sh
openssl dgst -sha512 -binary anthropic-ai-sandbox-runtime-0.0.75.tgz \
  | openssl base64 -A
```

Prefix that output with `sha512-`. After updating `../package-lock.json`,
calculate the new `npmDepsHash` for `../../../pi.nix` from the package directory:

```sh
nix run nixpkgs#prefetch-npm-deps -- package-lock.json
```

Finally, reinstall from a clean dependency state with `npm ci`, run
`npm run check`, confirm that the tarball contains the JAR but no Linux or
Windows executables, and build
`.#homeConfigurations.personal.activationPackage` from the repository root.
