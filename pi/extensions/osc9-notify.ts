import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";

const OSC = "\x1b]";
const STRING_TERMINATOR = "\x1b\\";
const REPEAT_DEBOUNCE_MS = 500;

// Public event emitted immediately before rpiv-ask-user-question shows its UI.
const ASK_USER_PROMPT_EVENT = "rpiv:ask-user:prompt";

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
  let restoreDialogHooks: (() => void) | undefined;

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

  const hookAgentDialogs = (ctx: ExtensionContext): void => {
    restoreDialogHooks?.();

    const ui = ctx.ui;
    const originalSelect = ui.select;
    const originalConfirm = ui.confirm;
    const originalInput = ui.input;
    const originalEditor = ui.editor;

    const maybeNotify = (title: string): void => {
      // Dialogs opened from an idle slash command already have the user's
      // attention. Notify only when an active agent blocks on human input.
      if (ctx.isIdle()) return;
      notify(
        isApprovalPrompt(title) ? "Pi: approval needed" : "Pi: input needed",
      );
    };

    const wrappedSelect: ExtensionUIContext["select"] = (
      title,
      options,
      opts,
    ) => {
      maybeNotify(title);
      return originalSelect.call(ui, title, options, opts);
    };
    const wrappedConfirm: ExtensionUIContext["confirm"] = (
      title,
      message,
      opts,
    ) => {
      maybeNotify(title);
      return originalConfirm.call(ui, title, message, opts);
    };
    const wrappedInput: ExtensionUIContext["input"] = (
      title,
      placeholder,
      opts,
    ) => {
      maybeNotify(title);
      return originalInput.call(ui, title, placeholder, opts);
    };
    const wrappedEditor: ExtensionUIContext["editor"] = (title, prefill) => {
      maybeNotify(title);
      return originalEditor.call(ui, title, prefill);
    };

    ui.select = wrappedSelect;
    ui.confirm = wrappedConfirm;
    ui.input = wrappedInput;
    ui.editor = wrappedEditor;

    restoreDialogHooks = () => {
      ui.select = originalSelect;
      ui.confirm = originalConfirm;
      ui.input = originalInput;
      ui.editor = originalEditor;
      restoreDialogHooks = undefined;
    };
  };

  pi.on("session_start", (_event, ctx) => {
    enabled = ctx.mode === "tui";
    if (enabled) hookAgentDialogs(ctx);
  });

  pi.on("agent_settled", (_event, ctx) => {
    if (ctx.mode === "tui") notify("Pi: task complete");
  });

  pi.on("session_shutdown", () => {
    restoreDialogHooks?.();
    enabled = false;
  });

  // The questionnaire uses custom TUI rather than the dialog methods wrapped
  // above, so consume its stable public event as well.
  pi.events.on(ASK_USER_PROMPT_EVENT, () => {
    notify("Pi: question waiting");
  });
}
