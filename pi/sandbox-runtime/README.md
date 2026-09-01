# pi-anthropic-sandbox-runtime

A Pi extension that runs seven policy-covered tools—`bash`, `read`,
`write`, `edit`, `ls`, `find`, and `grep`—through Anthropic Sandbox Runtime
enforcement. It also provides a separate, explicitly approved
`unsandboxed_bash` fallback.

## Development and validation

From a clean checkout, install the pinned development toolchain and run the
production type-check, helper syntax check, and test suite:

```sh
cd pi/sandbox-runtime
npm ci
npm run check
```

Verify the production package through the Home Manager activation build from
the repository root:

```sh
nix build --no-link .#homeConfigurations.personal.activationPackage
```

## Policy lookup and working directories

The global policy is loaded from `sandbox.json` in Pi's agent directory. For a
trusted project, the project policy is loaded from `.pi/sandbox.json` under the
process working directory captured when this extension initializes. The policy
is reloaded on every session startup, but its project lookup directory does not
follow working-directory changes recorded by resumed, forked, or otherwise
replaced sessions. The project-trust check still controls whether that policy is
read.

Policy lookup is intentionally independent from tool execution. The filesystem
helper and covered tools continue to use the active session context's working
directory, so relative paths and Bash/search commands run from that session
directory. That effective child directory is also passed to the macOS profile
generator; mandatory root paths never depend on the long-lived Pi broker's
working directory.

When filesystem sandboxing is enabled, macOS profiles deny writes to exact
child-root paths and to matching paths recursively at any absolute location.
Protected files are `.gitconfig`, `.gitmodules`, `.bashrc`, `.bash_profile`,
`.zshrc`, `.zprofile`, `.profile`, `.ripgreprc`, and `.mcp.json`. Protected
directories are `.vscode`, `.idea`, `.claude/commands`, `.claude/agents`, and
`.git/hooks`; both each directory vnode and its contents are denied. `.git/config`
is also denied unless `filesystem.allowGitConfig` is true, while Git hooks remain
denied under that option. `filesystem.disabled: true` intentionally bypasses all
filesystem enforcement, including these mandatory rules.

## Unsandboxed Bash fallback

Use `unsandboxed_bash` only after the normal, sandboxed `bash` tool fails
because Sandbox Runtime restrictions block the command. It has the same
`command` and optional `timeout` parameters as `bash`, but it is a separate
tool and remains available regardless of whether Sandbox Runtime is active,
disabled, or unavailable. Pi's normal `--tools` and `--exclude-tools`
filtering still applies.

Every `unsandboxed_bash` invocation requires a fresh explicit confirmation.
The approval inspector warns that Sandbox Runtime protections will not apply and
shows the command's exact UTF-8 byte length and SHA-256 digest. It also retains
the complete command and current working directory: TUI users inspect them in a
height-bounded viewport with Page Up/Page Down, while RPC clients receive the
complete details in the `select` request title.

Command and working-directory text is never rendered literally. Printable ASCII
is preserved except that a literal backslash is doubled; LF, CR, and tab display
as `\\n`, `\\r`, and `\\t`; other C0, DEL, and C1 controls display as
`\\xNN`; and every other non-ASCII code point displays as `\\u{HEX}`. Wrapped
value lines have trusted `C>` (command) or `D>` (working directory) prefixes.
This ASCII-only representation is reversible and makes literal escape text
unambiguous from actual control characters.

Approval is never cached and is denial-first. The TUI initially selects
`Cancel`; Escape, dialog cancellation, or signal abort denies execution. RPC
clients receive options in the exact order `Cancel`, then `Run unsandboxed`, and
only the exact `Run unsandboxed` response approves. Unknown responses, missing
responses, cancellation, abort, JSON mode, print mode, and every other context
without a supported dialog fail closed without starting the command.

Approving a command bypasses **all** Sandbox Runtime filesystem and network
protections for that command. After approval, execution otherwise uses Pi's
standard local Bash behavior, including streaming, cancellation, timeouts,
process cleanup, output truncation, and temporary files.

## Environment variables

This extension does not deny, mask, or otherwise filter inherited environment
variables. Sandboxed Bash commands and the sandboxed filesystem helper inherit
Pi's host environment in plaintext, including secrets. Sandboxed processes and
allowed network destinations can therefore observe those values. Users who need
environment isolation must sanitize the environment used to launch Pi.

Policies containing `credentials.envVars`, `credentials.awsPairs`, or
`credentials.sigv4` are rejected during initialization, even when those values
are explicitly empty. Credential-file rules under `credentials.files` remain
supported. Sandbox Runtime may also set operational proxy, TLS, JVM, and Git
environment variables needed to enforce filesystem and network policy.

## Global IPC and notifications

macOS sandbox profiles strictly deny host-global named POSIX shared memory,
named POSIX semaphores, Foundation distributed notifications, and Darwin
notifyd. There is no broker, per-invocation namespace, or configurable POSIX IPC
exception. Trusted policy composition also cannot restore the notification
channels: `network.allowMachLookup` entries are rejected when an exact name or
trailing-wildcard prefix intersects `com.apple.distributed_notifications…` or
`com.apple.system.notification_center`.

Ordinary Python and Foundation-linked commands remain supported, but Python
facilities backed by named POSIX IPC may fail with `EPERM`. This includes
`multiprocessing.shared_memory` and multiprocessing primitives that construct a
`SemLock`, such as some `Lock` and `Queue` configurations. That compatibility is
intentionally outside the sandboxed support contract. A workload that genuinely
requires these global primitives must use `unsandboxed_bash`, with a fresh
explicit approval for that invocation, or run with sandboxing deliberately
disabled.

## Keychain access

macOS Keychain APIs are unavailable by default. Generated profiles do not grant
Mach lookup access to the known Keychain brokers `com.apple.securityd.xpc`,
`com.apple.SecurityServer`, or `com.apple.secd`, so Security.framework and
`/usr/bin/security` workflows may fail with authorization or IPC errors. Direct
keychain-file read and write restrictions remain independently enforced by the
filesystem policy.

A trusted global or project policy can use `network.allowMachLookup` to add
exact service names, but this is an administrative escape hatch rather than a
narrow cryptographic API. Granting a Keychain service can restore access to
record metadata, ACL data, raw item data, and potentially plaintext secrets.
Only enable such a service when the resulting Keychain exposure is acceptable.

## Platform support

Only macOS is supported. On Linux, Windows, or any other unsupported host,
the extension fails closed: covered tools remain unavailable, even when
`--no-sandbox` is supplied.

Linux support was deliberately removed because the vendored Sandbox Runtime's
bubblewrap backend silently omits critical glob-based deny-write protections.
Point-in-time expansion of those globs would still leave files created later
unprotected, so Linux can be reconsidered only when the backend can enforce the
critical policy without semantic gaps.

Supported macOS hosts must also satisfy Anthropic Sandbox Runtime's own platform
and dependency checks.

## Network policy

Network allowlists are always strict. Leave `network.strictAllowlist` omitted (the
default policy enables it) or set it to `true`, and list every permitted
destination in `network.allowedDomains`. An effective `strictAllowlist: false`
policy is rejected during initialization, so covered tools fail closed in TUI,
RPC, JSON, and print modes rather than prompting or automatically approving an
unmatched destination.

To migrate a non-strict policy, remove `strictAllowlist` or change it to `true`
and add each required destination to `allowedDomains`.

## Optional search dependencies

The `find` tool requires `fd`, and the `grep` tool requires `rg` (ripgrep). These executables are checked only when their respective tools run; neither is required for sandbox startup or for unrelated tools such as `bash`, `read`, `write`, `edit`, and `ls`.

## RPC resource limits

The filesystem helper uses fixed safety limits (these are not `sandbox.json`
settings):

| Resource | Limit |
|---|---:|
| RPC frame payload | 1 MiB |
| Raw binary chunk | 64 KiB |
| Full-file, image, or write payload | 8 MiB |
| Concurrent RPC requests | 16 |
| Concurrent read operations | 4 |
| Text read output | 2,000 lines or 50 KiB |
| `ls` entries | 500 maximum |
| `find` results | 1,000 maximum |
| `grep` matches | 100 maximum |
| `grep` context | 10 lines before and after |
| Search command/rendered output | 50 KiB |

The `ls`, `find`, and `grep` limits are enforced in the helper before results
are serialized over RPC. `ls` scans the full directory while retaining only
the alphabetically smallest `limit + 1` eligible entries, using `O(limit)`
selection memory. `find` consumes NUL-delimited `fd --print0` output, stops
`fd` when stdout exceeds 50 KiB, and parses only complete NUL-terminated paths,
discarding all bytes after the last complete record. `grep` consumes bounded
`rg --json` events, obtains context from ripgrep rather than reading whole
files, truncates retained lines to 500 characters, and stops at 100 accepted
matches or 50 KiB of rendered lines. Lower per-call count limits remain
supported.

Human-readable path output from `ls`, `find`, and `grep` preserves printable
characters and non-ASCII Unicode while doubling literal backslashes. LF, CR,
and tab display as `\\n`, `\\r`, and `\\t`; other C0, DEL, and C1 controls
display as lowercase `\\xNN`. Structured `ls` names and `find` paths remain raw
across the helper RPC; grep's `displayPath` is escaped in the helper before
rendered-byte accounting.

Count limits, stdout/rendered-output limits, oversized grep events, truncated
stderr diagnostics, and long grep lines are reported independently. Empty
search results still include a truncation notice when helper output was
discarded, rather than presenting the result as unqualified and complete.

Text files of any size remain readable through bounded `offset`/`limit`
windows. The helper scans text incrementally and retains at most the text output
window. For files above 8 MiB, continuation messages remain truthful but may
omit exact total and remaining-line counts because the helper stops once it has
enough information to return the bounded window.

Images and edit full-file reads larger than 8 MiB are rejected with
`FILE_TOO_LARGE`. Write bodies and expanded edit results larger than 8 MiB are
also rejected before transfer. Accepted full-file responses are streamed one
chunk at a time; the helper does not retain a second full response buffer.

Host tool processing permits at most four concurrent read buffers, or 32 MiB of
declared raw full-file data in total. Transport memory additionally includes
one bounded frame in each direction, while image processing can require
separate downstream decoder/resizer working memory.

Malformed or oversized helper RPC output is treated as a helper protocol failure.
Only that helper is stopped; Pi remains running and the provider launches a new
helper on the next filesystem tool call.

Helper shutdown is graceful and bounded. The client closes the RPC input and
sends `SIGTERM` to the detached helper process group first, then escalates to
`SIGKILL` if the helper has not terminated within one second. Before exiting on
EOF, a protocol failure, `SIGTERM`, or `SIGINT`, the helper aborts active RPCs
and force-kills every detached `fd` and `rg` process group so search descendants
do not outlive it.

## Violation diagnostics

Sandbox violations are collected as clearly labeled, durable custom entries in
Pi's transcript, but their content is hidden by default. Collection continues
while they are hidden, so revealing diagnostics shows both historical entries
and violations from subsequent commands. The entries remain in the session
when it is saved or resumed.

Use the `/sandbox` command to inspect or control their runtime visibility:

- `/sandbox` reports sandbox status and whether violation diagnostics are hidden
  or shown.
- `/sandbox violations` toggles all violation entries in the active transcript.
- `/sandbox violations on|off|toggle` explicitly sets or toggles visibility.

Visibility is runtime-only and is not saved as session or global state. Every
startup, resume, new session, fork, or reload starts with diagnostics hidden,
even though durable entries from the session are still available to reveal.
Toggling off hides all entries again without deleting them.

Violation diagnostics are never mixed into Bash stdout or stderr, tool updates
or results, truncation files, user `!`/`!!` output, helper errors, or sandbox
state reasons. Pi excludes custom entries from LLM context, so diagnostics stay
user-only whether hidden or shown.

After a sandboxed Bash command closes, diagnostic collection waits for
command-attributed delivery to be idle for 30 ms, up to a hard 250 ms grace
period. Activity from concurrent commands does not reset that idle window.
Sandbox Runtime exposes no delivery watermark, so violations arriving after the
deadline can be absent from the custom transcript entry.

The long-running filesystem helper instead has a command-scoped subscription
for its full lifetime, installed before the helper starts and retained across
all of its RPCs. Newly observed occurrences are coalesced behind a trailing
250 ms summary timer, so a synchronous violation flood produces one durable
entry and a continuous stream can add at most four bounded helper summaries per
second. This is a bounded storage growth rate, not a hard lifetime cap on
entries.

Each helper summary aggregates exact duplicate lines in first-seen order and
retains at most 20 distinct detail lines. A retained detail is limited to 2,000
characters and carries an explicit `… [line truncated]` marker when shortened.
Every occurrence beyond the retained details is still counted in an explicit
`[N additional occurrences omitted]` line. Subscription de-duplication keeps
only the previous 100-occurrence Sandbox Runtime ring snapshot, including full
event identity and duplicate counts; repeated unchanged notifications are
ignored, and identities evicted from the ring do not accumulate for the helper
lifetime.

The subscription is removed when that helper exits, is stopped, or is
replaced, and session shutdown removes every active helper listener. Disposal
synchronously collects the last already-visible snapshot, cancels its summary
timer, flushes the final bounded summary once, and then unsubscribes. It does
not wait for later delivery, so violations delivered only after disposal can be
omitted.

All violation entries are best-effort diagnostics and are not an enforcement
signal.
