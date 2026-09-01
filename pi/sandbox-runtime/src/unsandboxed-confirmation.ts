import { createHash } from "node:crypto";
import type {
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@earendil-works/pi-coding-agent";
import {
  Key,
  matchesKey,
  truncateToWidth,
  wrapTextWithAnsi,
  type Component,
  type TUI,
} from "@earendil-works/pi-tui";

export const UNSANDBOXED_CANCEL = "Cancel";
export const UNSANDBOXED_RUN = "Run unsandboxed";

const RPC_VALUE_CHUNK_WIDTH = 64;
const COMMAND_LINE_PREFIX = "C> ";
const CWD_LINE_PREFIX = "D> ";

export interface UnsandboxedApprovalDetails {
  escapedCommand: string;
  escapedCwd: string;
  commandUtf8Bytes: number;
  commandSha256: string;
  identity: string;
  rpcTitle: string;
}

type DetailLine =
  | { kind: "heading"; text: string }
  | { kind: "command"; text: string }
  | { kind: "cwd"; text: string };

type ApprovalChoice =
  | typeof UNSANDBOXED_CANCEL
  | typeof UNSANDBOXED_RUN
  | undefined;

/**
 * Encode untrusted text into a reversible ASCII-only display form.
 *
 * Printable ASCII is preserved except for backslash, which is doubled. Named
 * escapes are used for LF, CR, and tab; other C0, DEL, and C1 controls use
 * \xNN; every remaining non-ASCII code point uses \u{HEX}.
 */
export function encodeUntrustedDisplay(value: string): string {
  let encoded = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint === 0x5c) {
      encoded += "\\\\";
    } else if (codePoint === 0x0a) {
      encoded += "\\n";
    } else if (codePoint === 0x0d) {
      encoded += "\\r";
    } else if (codePoint === 0x09) {
      encoded += "\\t";
    } else if (
      codePoint < 0x20 ||
      (codePoint >= 0x7f && codePoint <= 0x9f)
    ) {
      encoded += `\\x${codePoint.toString(16).toUpperCase().padStart(2, "0")}`;
    } else if (codePoint > 0x7e) {
      encoded += `\\u{${codePoint.toString(16).toUpperCase()}}`;
    } else {
      encoded += character;
    }
  }
  return encoded;
}

/** Decode values produced by encodeUntrustedDisplay(). */
export function decodeUntrustedDisplay(value: string): string {
  let decoded = "";
  for (let index = 0; index < value.length; index++) {
    const character = value[index]!;
    if (character !== "\\") {
      decoded += character;
      continue;
    }

    const escape = value[++index];
    if (escape === "\\") decoded += "\\";
    else if (escape === "n") decoded += "\n";
    else if (escape === "r") decoded += "\r";
    else if (escape === "t") decoded += "\t";
    else if (escape === "x") {
      const hex = value.slice(index + 1, index + 3);
      if (!/^[0-9A-F]{2}$/.test(hex)) {
        throw new Error("Invalid \\x escape in display value");
      }
      decoded += String.fromCharCode(Number.parseInt(hex, 16));
      index += 2;
    } else if (escape === "u" && value[index + 1] === "{") {
      const end = value.indexOf("}", index + 2);
      const hex = end === -1 ? "" : value.slice(index + 2, end);
      if (!/^[0-9A-F]+$/.test(hex)) {
        throw new Error("Invalid \\u escape in display value");
      }
      const codePoint = Number.parseInt(hex, 16);
      if (codePoint > 0x10ffff) {
        throw new Error("Display escape is outside the Unicode range");
      }
      decoded += String.fromCodePoint(codePoint);
      index = end;
    } else {
      throw new Error("Invalid escape in display value");
    }
  }
  return decoded;
}

function prefixedValueLines(
  prefix: string,
  value: string,
  chunkWidth: number,
): string[] {
  const width = Math.max(1, Math.floor(chunkWidth));
  if (value.length === 0) return [prefix];
  const lines: string[] = [];
  for (let offset = 0; offset < value.length; offset += width) {
    lines.push(prefix + value.slice(offset, offset + width));
  }
  return lines;
}

function rpcValueSection(label: string, prefix: string, value: string): string[] {
  return [
    `${label} (escaped, complete; every value line is prefixed):`,
    ...prefixedValueLines(prefix, value, RPC_VALUE_CHUNK_WIDTH),
  ];
}

export function buildUnsandboxedApprovalDetails(
  command: string,
  cwd: string,
): UnsandboxedApprovalDetails {
  const commandBytes = Buffer.from(command, "utf8");
  const commandSha256 = createHash("sha256").update(commandBytes).digest("hex");
  const commandUtf8Bytes = commandBytes.byteLength;
  const escapedCommand = encodeUntrustedDisplay(command);
  const escapedCwd = encodeUntrustedDisplay(cwd);
  const identity =
    `Command identity: ${commandUtf8Bytes} UTF-8 bytes; ` +
    `SHA-256 ${commandSha256}`;
  const rpcTitle = [
    "WARNING: UNSANDBOXED BASH - Sandbox Runtime protections WILL NOT APPLY.",
    identity,
    ...rpcValueSection("COMMAND", COMMAND_LINE_PREFIX, escapedCommand),
    ...rpcValueSection("WORKING DIRECTORY", CWD_LINE_PREFIX, escapedCwd),
  ].join("\n");

  return {
    escapedCommand,
    escapedCwd,
    commandUtf8Bytes,
    commandSha256,
    identity,
    rpcTitle,
  };
}

function wrapTrusted(text: string, width: number): string[] {
  return wrapTextWithAnsi(text, Math.max(1, width));
}

export class UnsandboxedApprovalComponent implements Component {
  private selectedAction = 0;
  private scrollOffset = 0;
  private viewportHeight = 1;
  private detailWidth: number | undefined;
  private detailLines: DetailLine[] = [];
  private finished = false;
  private readonly abortListener: (() => void) | undefined;
  private readonly tui: TUI;
  private readonly theme: Theme;
  private readonly keybindings: KeybindingsManager;
  private readonly details: UnsandboxedApprovalDetails;
  private readonly done: (choice: ApprovalChoice) => void;
  private readonly signal: AbortSignal | undefined;

  constructor(
    tui: TUI,
    theme: Theme,
    keybindings: KeybindingsManager,
    details: UnsandboxedApprovalDetails,
    done: (choice: ApprovalChoice) => void,
    signal?: AbortSignal,
  ) {
    this.tui = tui;
    this.theme = theme;
    this.keybindings = keybindings;
    this.details = details;
    this.done = done;
    this.signal = signal;
    if (signal) {
      this.abortListener = () => this.finish(undefined);
      signal.addEventListener("abort", this.abortListener, { once: true });
    }
  }

  private finish(choice: ApprovalChoice): void {
    if (this.finished) return;
    this.finished = true;
    if (this.signal && this.abortListener) {
      this.signal.removeEventListener("abort", this.abortListener);
    }
    this.done(choice);
  }

  private matches(
    data: string,
    binding:
      | "tui.select.up"
      | "tui.select.down"
      | "tui.select.pageUp"
      | "tui.select.pageDown"
      | "tui.select.confirm"
      | "tui.select.cancel",
    fallback: Parameters<typeof matchesKey>[1],
  ): boolean {
    return this.keybindings.matches(data, binding) || matchesKey(data, fallback);
  }

  handleInput(data: string): void {
    if (this.matches(data, "tui.select.cancel", Key.escape)) {
      this.finish(undefined);
      return;
    }
    if (this.matches(data, "tui.select.confirm", Key.enter)) {
      this.finish(
        this.selectedAction === 1
          ? UNSANDBOXED_RUN
          : UNSANDBOXED_CANCEL,
      );
      return;
    }
    if (this.matches(data, "tui.select.pageUp", Key.pageUp)) {
      this.scrollOffset -= Math.max(1, this.viewportHeight);
      this.clampScroll();
      this.tui.requestRender();
      return;
    }
    if (this.matches(data, "tui.select.pageDown", Key.pageDown)) {
      this.scrollOffset += Math.max(1, this.viewportHeight);
      this.clampScroll();
      this.tui.requestRender();
      return;
    }
    if (
      this.matches(data, "tui.select.up", Key.up) ||
      matchesKey(data, Key.left)
    ) {
      this.selectedAction = 0;
      this.tui.requestRender();
      return;
    }
    if (
      this.matches(data, "tui.select.down", Key.down) ||
      matchesKey(data, Key.right)
    ) {
      this.selectedAction = 1;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.tab)) {
      this.selectedAction = this.selectedAction === 0 ? 1 : 0;
      this.tui.requestRender();
    }
  }

  private rebuildDetailLines(width: number): void {
    if (this.detailWidth === width) return;
    this.detailWidth = width;
    this.detailLines = [];

    const commandHeading = wrapTrusted(
      "COMMAND (escaped and complete; C> prefixes every value line):",
      width,
    );
    for (const text of commandHeading) {
      this.detailLines.push({ kind: "heading", text });
    }
    const commandChunkWidth = Math.max(
      1,
      width - COMMAND_LINE_PREFIX.length,
    );
    for (const text of prefixedValueLines(
      COMMAND_LINE_PREFIX,
      this.details.escapedCommand,
      commandChunkWidth,
    )) {
      this.detailLines.push({ kind: "command", text });
    }

    const cwdHeading = wrapTrusted(
      "WORKING DIRECTORY (escaped and complete; D> prefixes every value line):",
      width,
    );
    for (const text of cwdHeading) {
      this.detailLines.push({ kind: "heading", text });
    }
    const cwdChunkWidth = Math.max(1, width - CWD_LINE_PREFIX.length);
    for (const text of prefixedValueLines(
      CWD_LINE_PREFIX,
      this.details.escapedCwd,
      cwdChunkWidth,
    )) {
      this.detailLines.push({ kind: "cwd", text });
    }
    this.clampScroll();
  }

  private clampScroll(): void {
    const maximum = Math.max(0, this.detailLines.length - this.viewportHeight);
    this.scrollOffset = Math.max(0, Math.min(maximum, this.scrollOffset));
  }

  private renderDetailLine(line: DetailLine, width: number): string {
    if (line.kind === "heading") {
      return truncateToWidth(this.theme.fg("accent", line.text), width, "");
    }
    const prefix = line.kind === "command" ? COMMAND_LINE_PREFIX : CWD_LINE_PREFIX;
    const value = line.text.slice(prefix.length);
    return truncateToWidth(
      this.theme.fg("warning", prefix) + this.theme.fg("text", value),
      width,
      "",
    );
  }

  render(requestedWidth: number): string[] {
    const width = Math.max(1, Math.floor(requestedWidth));
    this.rebuildDetailLines(width);

    const warningLines = wrapTrusted(
      this.theme.fg(
        "warning",
        this.theme.bold(
          "WARNING: UNSANDBOXED BASH - Sandbox Runtime protections WILL NOT APPLY.",
        ),
      ),
      width,
    );
    const identityLines = wrapTrusted(
      this.theme.fg("muted", this.details.identity),
      width,
    );

    const action = (index: number, label: string): string => {
      const marker = index === this.selectedAction ? "> " : "  ";
      const text = `${marker}${label}`;
      return index === this.selectedAction
        ? this.theme.bg("selectedBg", this.theme.bold(text))
        : this.theme.fg(index === 1 ? "warning" : "text", text);
    };
    const actionLines = wrapTrusted(
      `Actions: ${action(0, UNSANDBOXED_CANCEL)}    ${action(1, UNSANDBOXED_RUN)}`,
      width,
    );
    const helpLines = wrapTrusted(
      this.theme.fg(
        "dim",
        "Page Up/Down scroll | Up/Down choose | Enter select | Esc cancel",
      ),
      width,
    );

    const terminalRows = Math.max(1, Math.floor(this.tui.terminal.rows));
    const fixedRows =
      warningLines.length +
      identityLines.length +
      actionLines.length +
      helpLines.length +
      1;
    this.viewportHeight = Math.max(1, terminalRows - fixedRows);
    this.viewportHeight = Math.min(
      this.viewportHeight,
      Math.max(1, this.detailLines.length),
    );
    this.clampScroll();

    const detailEnd = Math.min(
      this.detailLines.length,
      this.scrollOffset + this.viewportHeight,
    );
    const visibleDetails = this.detailLines
      .slice(this.scrollOffset, detailEnd)
      .map((line) => this.renderDetailLine(line, width));
    const firstVisible = this.detailLines.length === 0 ? 0 : this.scrollOffset + 1;
    const position = truncateToWidth(
      this.theme.fg(
        "muted",
        `Details: lines ${firstVisible}-${detailEnd} of ${this.detailLines.length}`,
      ),
      width,
      "",
    );

    return [
      ...warningLines,
      ...identityLines,
      ...visibleDetails,
      position,
      ...actionLines,
      ...helpLines,
    ];
  }

  invalidate(): void {
    // Preserve the current position until render rebuilds all wrapped lines for
    // the new width, then clamp it against the resized viewport.
    this.detailWidth = undefined;
  }

  dispose(): void {
    if (this.signal && this.abortListener) {
      this.signal.removeEventListener("abort", this.abortListener);
    }
  }
}

export async function requestUnsandboxedApproval(
  ctx: ExtensionContext,
  command: string,
  cwd: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!ctx.hasUI || signal?.aborted) return false;

  const details = buildUnsandboxedApprovalDetails(command, cwd);
  let choice: string | undefined;
  try {
    if (ctx.mode === "rpc") {
      choice = await ctx.ui.select(
        details.rpcTitle,
        [UNSANDBOXED_CANCEL, UNSANDBOXED_RUN],
        { signal },
      );
    } else if (ctx.mode === "tui") {
      choice = await ctx.ui.custom<ApprovalChoice>(
        (tui, theme, keybindings, done) => {
          const component = new UnsandboxedApprovalComponent(
            tui,
            theme,
            keybindings,
            details,
            done,
            signal,
          );
          if (signal?.aborted) queueMicrotask(() => done(undefined));
          return component;
        },
      );
    } else {
      return false;
    }
  } catch {
    return false;
  }

  return choice === UNSANDBOXED_RUN && signal?.aborted !== true;
}
