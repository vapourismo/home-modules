import { createHash } from "node:crypto";
import { EOL } from "node:os";
import { SandboxManager, type SandboxViolationEvent } from "@anthropic-ai/sandbox-runtime";

export interface SandboxViolationStoreLookup {
  getViolationsForCommand(commandId: string): Array<Pick<SandboxViolationEvent, "line">>;
}

export interface SandboxViolationStoreObservable extends SandboxViolationStoreLookup {
  getViolationsForCommand(commandId: string): SandboxViolationEvent[];
  subscribe(listener: (violations: SandboxViolationEvent[]) => void): () => void;
}

const VIOLATION_IDLE_MILLISECONDS = 30;
const VIOLATION_DEADLINE_MILLISECONDS = 250;
const HELPER_SUMMARY_MILLISECONDS = 250;
const SANDBOX_VIOLATION_RING_OCCURRENCES = 100;
const MAX_SUMMARY_DETAIL_LINES = 20;
const MAX_SUMMARY_LINE_CHARACTERS = 2_000;
const LINE_TRUNCATION_MARKER = "… [line truncated]";

interface PendingViolationLine {
  count: number;
  linePrefix: string;
  truncated: boolean;
}

interface PendingViolationSummary {
  lines: Map<string, PendingViolationLine>;
  omittedOccurrences: number;
}

function violationOccurrenceKey(violation: SandboxViolationEvent): string {
  return JSON.stringify([
    violation.line,
    violation.command,
    violation.encodedCommand,
    violation.timestamp.getTime(),
  ]);
}

function violationCounts(violations: SandboxViolationEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const violation of violations) {
    const key = violationOccurrenceKey(violation);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function hasAddedViolation(previous: Map<string, number>, current: Map<string, number>): boolean {
  for (const [key, count] of current) {
    if (count > (previous.get(key) ?? 0)) return true;
  }
  return false;
}

function annotationForViolations(
  violations: Array<Pick<SandboxViolationEvent, "line">>,
): string {
  if (violations.length === 0) return "";

  const counts = new Map<string, number>();
  for (const violation of violations) {
    counts.set(violation.line, (counts.get(violation.line) ?? 0) + 1);
  }

  const lines: string[] = [];
  for (const [line, count] of counts) {
    lines.push(count === 1 ? line : `${line} [${count} occurrences]`);
  }

  return ["<sandbox_violations>", ...lines, "</sandbox_violations>"].join(EOL);
}

function emptyPendingSummary(): PendingViolationSummary {
  return {
    lines: new Map<string, PendingViolationLine>(),
    omittedOccurrences: 0,
  };
}

function violationLineKey(line: string): string {
  const digest = createHash("sha256").update(line).digest("base64url");
  return `${line.length}:${digest}`;
}

function addPendingViolation(summary: PendingViolationSummary, line: string): void {
  const key = violationLineKey(line);
  const retained = summary.lines.get(key);
  if (retained) {
    retained.count++;
    return;
  }

  if (summary.lines.size >= MAX_SUMMARY_DETAIL_LINES) {
    summary.omittedOccurrences++;
    return;
  }

  summary.lines.set(key, {
    count: 1,
    linePrefix: line.slice(0, MAX_SUMMARY_LINE_CHARACTERS),
    truncated: line.length > MAX_SUMMARY_LINE_CHARACTERS,
  });
}

function renderPendingLine(line: PendingViolationLine): string {
  const occurrenceSuffix = line.count === 1 ? "" : ` [${line.count} occurrences]`;
  if (!line.truncated && line.linePrefix.length + occurrenceSuffix.length <= MAX_SUMMARY_LINE_CHARACTERS) {
    return `${line.linePrefix}${occurrenceSuffix}`;
  }

  const prefixLength = Math.max(
    0,
    MAX_SUMMARY_LINE_CHARACTERS - LINE_TRUNCATION_MARKER.length - occurrenceSuffix.length,
  );
  return `${line.linePrefix.slice(0, prefixLength)}${LINE_TRUNCATION_MARKER}${occurrenceSuffix}`;
}

function annotationForPendingSummary(summary: PendingViolationSummary): string {
  const lines = [...summary.lines.values()].map(renderPendingLine);
  if (summary.omittedOccurrences > 0) {
    lines.push(`[${summary.omittedOccurrences} additional occurrences omitted]`);
  }
  if (lines.length === 0) return "";
  return ["<sandbox_violations>", ...lines, "</sandbox_violations>"].join(EOL);
}

/**
 * Subscribe to newly retained violations attributed to one long-running
 * command. Store access and reporting are deliberately best-effort so
 * diagnostics cannot affect the command's lifecycle.
 */
export function subscribeToSandboxViolations(
  commandId: string,
  report: (diagnostic: string) => void,
  suppliedStore?: SandboxViolationStoreObservable,
): () => void {
  let disposed = false;
  let disposing = false;
  let unsubscribe: (() => void) | undefined;
  let summaryTimer: NodeJS.Timeout | undefined;
  let previousSnapshotCounts = new Map<string, number>();
  let pendingSummary = emptyPendingSummary();

  let store: SandboxViolationStoreObservable;
  try {
    store = suppliedStore ?? SandboxManager.getSandboxViolationStore();
  } catch {
    return () => {};
  }

  const flushPendingSummary = () => {
    const summary = pendingSummary;
    pendingSummary = emptyPendingSummary();
    const diagnostic = annotationForPendingSummary(summary);
    if (!diagnostic) return;

    try {
      report(diagnostic);
    } catch {
      // A failed reporter is an intentional best-effort omission. The batch
      // was cleared before reporting, so uncertain history is never replayed.
    }
  };

  const scheduleSummary = () => {
    if (summaryTimer || disposed || disposing) return;
    summaryTimer = setTimeout(() => {
      summaryTimer = undefined;
      if (disposed || disposing) return;
      flushPendingSummary();
    }, HELPER_SUMMARY_MILLISECONDS);
    summaryTimer.unref();
  };

  const processSnapshot = (duringDisposal = false) => {
    if (disposed || (disposing && !duringDisposal)) return;
    try {
      const retainedViolations = store
        .getViolationsForCommand(commandId)
        .slice(-SANDBOX_VIOLATION_RING_OCCURRENCES);
      const snapshotCounts = new Map<string, number>();
      const newlyObserved: SandboxViolationEvent[] = [];

      for (const violation of retainedViolations) {
        const key = violationOccurrenceKey(violation);
        const occurrence = (snapshotCounts.get(key) ?? 0) + 1;
        snapshotCounts.set(key, occurrence);
        if (occurrence > (previousSnapshotCounts.get(key) ?? 0)) {
          newlyObserved.push(violation);
        }
      }

      // Keep only the previous retained ring snapshot. This advances state
      // before any eventual report and drops identities evicted by the ring.
      previousSnapshotCounts = snapshotCounts;
      if (newlyObserved.length === 0) return;

      for (const violation of newlyObserved) {
        addPendingViolation(pendingSummary, violation.line);
      }
      if (!duringDisposal) scheduleSummary();
    } catch {
      // Store notifications and lookups are best-effort diagnostics only.
    }
  };

  try {
    unsubscribe = store.subscribe(() => {
      try {
        processSnapshot();
      } catch {
        // Never let a collector callback escape into Sandbox Runtime.
      }
    });
  } catch {
    // A usable disposer is still returned if subscription setup fails.
  }

  // The real store delivers its retained snapshot synchronously from
  // subscribe. Query once as well so non-conforming/test stores cannot leave a
  // startup violation unreported; snapshot counts de-duplicate both paths.
  processSnapshot();

  return () => {
    if (disposed || disposing) return;
    disposing = true;

    // Capture a store mutation already visible before listener teardown, then
    // synchronously flush the final bounded batch. Mark disposal before the
    // reporter runs so reentrant or later notifications are intentionally
    // omitted rather than opening a summary window that can never complete.
    processSnapshot(true);
    if (summaryTimer) clearTimeout(summaryTimer);
    summaryTimer = undefined;
    disposed = true;
    flushPendingSummary();

    const disposeSubscription = unsubscribe;
    unsubscribe = undefined;
    if (disposeSubscription) {
      try {
        disposeSubscription();
      } catch {
        // Listener cleanup is best-effort and must remain idempotent.
      }
    }
  };
}

/**
 * Wait for command-attributed violation delivery to become idle, bounded by a
 * hard deadline because Sandbox Runtime exposes no delivery watermark.
 */
export async function waitForSandboxViolationDelivery(
  commandId: string,
  store: SandboxViolationStoreObservable = SandboxManager.getSandboxViolationStore(),
): Promise<void> {
  const initialViolations = store.getViolationsForCommand(commandId);
  let previousCounts = violationCounts(initialViolations);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    let idleTimer: NodeJS.Timeout | undefined;
    let deadlineTimer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (deadlineTimer) clearTimeout(deadlineTimer);
      unsubscribe?.();
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(finish, VIOLATION_IDLE_MILLISECONDS);
    };

    deadlineTimer = setTimeout(finish, VIOLATION_DEADLINE_MILLISECONDS);
    try {
      unsubscribe = store.subscribe(() => {
        if (settled) return;
        try {
          const currentCounts = violationCounts(store.getViolationsForCommand(commandId));
          const matchingViolationAdded = hasAddedViolation(previousCounts, currentCounts);
          previousCounts = currentCounts;
          if (matchingViolationAdded) resetIdleTimer();
        } catch (error) {
          fail(error);
        }
      });
    } catch (error) {
      fail(error);
      return;
    }

    // A synchronous subscription callback can fail before subscribe returns.
    if (settled) {
      unsubscribe?.();
      return;
    }
    if (initialViolations.length > 0) resetIdleTimer();
  });
}

/** Format the sanitized violation lines attributed to one sandboxed command. */
export function sandboxViolationAnnotation(
  commandId: string,
  store: SandboxViolationStoreLookup = SandboxManager.getSandboxViolationStore(),
): string {
  return annotationForViolations(store.getViolationsForCommand(commandId));
}
