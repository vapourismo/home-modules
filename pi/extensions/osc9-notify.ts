import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const OSC = "\x1b]";
const STRING_TERMINATOR = "\x1b\\";
const REPEAT_DEBOUNCE_MS = 500;

/** Build an OSC 9 desktop-notification sequence. */
export function formatOsc9Notification(message: string): string {
  // OSC payloads must not contain control characters, especially ESC/ST, because
  // those could terminate the sequence and inject another terminal command.
  const title =
    message.replace(/[\x00-\x1f\x7f-\x9f]/g, " ").trim() ||
    "Pi needs your attention";
  return `${OSC}9;${title}${STRING_TERMINATOR}`;
}

/** Send an OSC 9 desktop notification to Pi's terminal. */
export function sendOsc9Notification(
  message: string,
  write: (sequence: string) => unknown = (sequence) =>
    process.stdout.write(sequence),
): void {
  write(formatOsc9Notification(message));
}

function isApprovalPrompt(title: string): boolean {
  return /\b(?:allow|approval|approve|authorize|blocked|permission)\b/i.test(
    title,
  );
}

export default function osc9Notify(pi: ExtensionAPI): void {
  let enabled = false;
  let lastMessage: string | undefined;
  let lastNotificationAt = 0;

  const notify = (message: string): void => {
    if (!enabled) return;

    const now = Date.now();
    if (
      message === lastMessage &&
      now - lastNotificationAt < REPEAT_DEBOUNCE_MS
    )
      return;

    lastMessage = message;
    lastNotificationAt = now;
    try {
      sendOsc9Notification(message);
    } catch {
      // A notification failure must never interrupt the agent or an approval.
    }
  };

  pi.on("session_start", (_event, ctx) => {
    enabled = ctx.mode === "tui";
  });

  pi.on("ui_prompt_start", (event, ctx) => {
    // Prompts opened from an idle slash command already have the user's
    // attention. Notify only when an active TUI agent blocks on human input.
    if (ctx.mode !== "tui" || ctx.isIdle()) return;

    if (event.title && isApprovalPrompt(event.title)) {
      notify("pi: approval needed");
    } else if (event.kind === "custom" && !event.title) {
      notify("pi: question waiting");
    } else {
      notify("pi: input needed");
    }
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (ctx.mode === "tui") notify("pi: task complete");
  });

  pi.on("session_shutdown", () => {
    enabled = false;
  });
}
