import { homedir } from "node:os";
import path from "node:path";

const NARROW_NO_BREAK_SPACE = "\u202f";
const UNICODE_SPACES = /[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g;

function stripAtPrefix(value: string): string {
  return value.startsWith("@") ? value.slice(1) : value;
}

function expandHome(value: string, home: string): string {
  if (value === "~") return home;
  if (value.startsWith("~/")) return path.join(home, value.slice(2));
  return value;
}

/** Resolve a tool path using string operations only; this performs no filesystem probes. */
export function resolveSyntacticPath(input: string, cwd: string, home = homedir()): string {
  const normalized = stripAtPrefix(input.replace(UNICODE_SPACES, " "));
  const expanded = expandHome(normalized, home);
  return path.normalize(path.isAbsolute(expanded) ? expanded : path.resolve(cwd, expanded));
}

/**
 * Built-in read accepts a few common macOS filename spellings. Generate the
 * variants syntactically and let the sandboxed helper decide which exists.
 */
export function readPathCandidates(input: string, cwd: string, home = homedir()): string[] {
  const resolved = resolveSyntacticPath(input, cwd, home);
  const variants = [
    resolved,
    resolved.replace(/ (AM|PM)\./gi, `${NARROW_NO_BREAK_SPACE}$1.`),
    resolved.normalize("NFD"),
    resolved.replaceAll("'", "’"),
    resolved.normalize("NFD").replaceAll("'", "’"),
  ];
  return [...new Set(variants)];
}

