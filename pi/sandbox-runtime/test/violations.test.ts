import assert from "node:assert/strict";
import { EOL } from "node:os";
import test from "node:test";
import type { SandboxViolationEvent } from "@anthropic-ai/sandbox-runtime";
import {
  sandboxViolationAnnotation,
  subscribeToSandboxViolations,
  waitForSandboxViolationDelivery,
  type SandboxViolationStoreLookup,
  type SandboxViolationStoreObservable,
} from "../src/violations.ts";

function annotation(...lines: string[]): string {
  return ["<sandbox_violations>", ...lines, "</sandbox_violations>"].join(EOL);
}

function fakeStore(
  violationsByCommand: Record<string, string[]>,
  lookups: string[] = [],
): SandboxViolationStoreLookup {
  return {
    getViolationsForCommand(commandId) {
      lookups.push(commandId);
      return (violationsByCommand[commandId] ?? []).map((line) => ({ line }));
    },
  };
}

async function waitForDiagnostics(diagnostics: string[], count: number): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (diagnostics.length < count && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(diagnostics.length, count);
}

class ObservableFakeStore implements SandboxViolationStoreObservable {
  readonly violationsByCommand = new Map<string, SandboxViolationEvent[]>();
  readonly listeners = new Set<(violations: SandboxViolationEvent[]) => void>();
  readonly lookups: string[] = [];
  unsubscribeCount = 0;
  private sequence = 0;

  getViolationsForCommand(commandId: string): SandboxViolationEvent[] {
    this.lookups.push(commandId);
    return [...(this.violationsByCommand.get(commandId) ?? [])];
  }

  addViolation(
    commandId: string,
    line: string,
    overrides: Partial<SandboxViolationEvent> = {},
  ): SandboxViolationEvent {
    const violation: SandboxViolationEvent = {
      line,
      command: commandId,
      timestamp: new Date(this.sequence++),
      ...overrides,
    };
    const violations = this.violationsByCommand.get(commandId) ?? [];
    violations.push(violation);
    this.violationsByCommand.set(commandId, violations);
    this.notify();
    return violation;
  }

  addBatch(commandId: string, violations: SandboxViolationEvent[]): void {
    const current = this.violationsByCommand.get(commandId) ?? [];
    current.push(...violations);
    this.violationsByCommand.set(commandId, current);
    this.notify();
  }

  notify(): void {
    const allViolations = [...this.violationsByCommand.values()].flat();
    for (const listener of this.listeners) listener(allViolations);
  }

  subscribe(listener: (violations: SandboxViolationEvent[]) => void): () => void {
    this.listeners.add(listener);
    listener([...this.violationsByCommand.values()].flat());
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(listener);
      this.unsubscribeCount++;
    };
  }
}

test("returns no annotation when a command has no violations", () => {
  assert.equal(sandboxViolationAnnotation("command-1", fakeStore({})), "");
});

test("emits one violation unchanged", () => {
  const line = "bash(123) deny(1) file-read-data /private/example";
  assert.equal(sandboxViolationAnnotation("command-1", fakeStore({ "command-1": [line] })), annotation(line));
});

test("preserves first-seen order", () => {
  const first = "first(1) deny(1) operation /one";
  const second = "second(2) deny(1) operation /two";
  const third = "third(3) deny(1) operation /three";
  assert.equal(
    sandboxViolationAnnotation("command-1", fakeStore({ "command-1": [first, second, third] })),
    annotation(first, second, third),
  );
});

test("aggregates only exact duplicate lines with their occurrence count", () => {
  const repeated = "bash(123) deny(1) file-read-data /private/example";
  const other = "node(456) deny(1) mach-lookup com.example.service";
  assert.equal(
    sandboxViolationAnnotation("command-1", fakeStore({
      "command-1": [repeated, other, repeated, repeated, other],
    })),
    annotation(`${repeated} [3 occurrences]`, `${other} [2 occurrences]`),
  );
});

test("keeps distinct near-matching violations separate", () => {
  const lines = [
    "bash(123) deny(1) file-read-data /private/example",
    "bash(124) deny(1) file-read-data /private/example",
    "node(123) deny(1) file-read-data /private/example",
    "bash(123) deny(1) file-read-data /private/examples",
  ];
  assert.equal(
    sandboxViolationAnnotation("command-1", fakeStore({ "command-1": lines })),
    annotation(...lines),
  );
});

test("looks up violations only by the supplied command ID", () => {
  const lookups: string[] = [];
  const store = fakeStore({
    "command-1": ["bash(1) deny(1) operation /one"],
    "command-2": ["bash(2) deny(1) operation /two"],
  }, lookups);

  assert.equal(
    sandboxViolationAnnotation("command-2", store),
    annotation("bash(2) deny(1) operation /two"),
  );
  assert.deepEqual(lookups, ["command-2"]);
});

test("command subscription combines initial and delayed violations without replaying snapshots", async () => {
  const store = new ObservableFakeStore();
  const initial = "node(1) deny(1) operation /initial";
  const delayed = "node(2) deny(1) operation /delayed";
  store.addViolation("command-1", initial);
  const diagnostics: string[] = [];

  const dispose = subscribeToSandboxViolations(
    "command-1",
    (diagnostic) => diagnostics.push(diagnostic),
    store,
  );
  assert.deepEqual(diagnostics, []);

  store.notify();
  store.addViolation("command-1", delayed);
  store.addViolation("command-1", delayed);
  store.notify();
  await waitForDiagnostics(diagnostics, 1);
  assert.deepEqual(diagnostics, [
    annotation(initial, `${delayed} [2 occurrences]`),
  ]);
  assert.ok(store.lookups.every((commandId) => commandId === "command-1"));

  store.notify();
  store.notify();
  dispose();
  assert.equal(diagnostics.length, 1, "unchanged snapshots must not create a pending report");
});

test("command subscription counts newly added exact duplicate occurrences in one window", async () => {
  const store = new ObservableFakeStore();
  const line = "node(3) deny(1) operation /duplicate";
  const occurrence: SandboxViolationEvent = {
    line,
    command: "pi sandbox filesystem helper",
    encodedCommand: "encoded-command-id",
    timestamp: new Date(123),
  };
  store.addBatch("command-1", [occurrence]);
  const diagnostics: string[] = [];
  const dispose = subscribeToSandboxViolations(
    "command-1",
    (diagnostic) => diagnostics.push(diagnostic),
    store,
  );

  store.addBatch("command-1", [{ ...occurrence }, { ...occurrence }]);
  store.notify();
  await waitForDiagnostics(diagnostics, 1);
  assert.deepEqual(diagnostics, [annotation(`${line} [3 occurrences]`)]);

  dispose();
});

test("command subscription identity includes line, command forms, and timestamp", async () => {
  const store = new ObservableFakeStore();
  const line = "node(4) deny(1) operation /identity";
  const original: SandboxViolationEvent = {
    line,
    command: "helper-a",
    encodedCommand: "encoded-a",
    timestamp: new Date(40),
  };
  store.addBatch("command-1", [original]);
  const diagnostics: string[] = [];
  const dispose = subscribeToSandboxViolations(
    "command-1",
    (diagnostic) => diagnostics.push(diagnostic),
    store,
  );

  store.addBatch("command-1", [
    { ...original, command: "helper-b" },
    { ...original, encodedCommand: "encoded-b" },
    { ...original, timestamp: new Date(41) },
  ]);
  await waitForDiagnostics(diagnostics, 1);
  assert.deepEqual(diagnostics, [annotation(`${line} [4 occurrences]`)]);

  dispose();
});

test("command subscription ignores unrelated events and preserves summary order", async () => {
  const store = new ObservableFakeStore();
  const diagnostics: string[] = [];
  const dispose = subscribeToSandboxViolations(
    "command-1",
    (diagnostic) => diagnostics.push(diagnostic),
    store,
  );

  store.addViolation("command-2", "node(4) deny(1) operation /unrelated");
  assert.deepEqual(diagnostics, []);
  const repeated = "node(5) deny(1) operation /repeated";
  const other = "node(6) deny(1) operation /other";
  store.addBatch("command-1", [
    { line: repeated, command: "helper", timestamp: new Date(10) },
    { line: other, command: "helper", timestamp: new Date(11) },
    { line: repeated, command: "helper", timestamp: new Date(12) },
  ]);
  await waitForDiagnostics(diagnostics, 1);
  assert.deepEqual(diagnostics, [
    annotation(`${repeated} [2 occurrences]`, other),
  ]);
  assert.ok(store.lookups.every((commandId) => commandId === "command-1"));

  dispose();
});

test("command subscription starts a new window for reentrant notifications", async () => {
  const store = new ObservableFakeStore();
  const first = "node(7) deny(1) operation /first";
  const second = "node(8) deny(1) operation /second";
  const diagnostics: string[] = [];
  const reportTimes: number[] = [];
  let deliveredSecond = false;
  const dispose = subscribeToSandboxViolations(
    "command-1",
    (diagnostic) => {
      diagnostics.push(diagnostic);
      reportTimes.push(Date.now());
      if (!deliveredSecond) {
        deliveredSecond = true;
        store.addViolation("command-1", second);
        store.notify();
      }
    },
    store,
  );

  store.addViolation("command-1", first);
  store.notify();
  await waitForDiagnostics(diagnostics, 2);
  assert.deepEqual(diagnostics, [annotation(first), annotation(second)]);
  assert.ok(reportTimes[1]! - reportTimes[0]! >= 240, "summary windows must be rate-limited");

  dispose();
});

test("command subscription isolates reporter failures and continues with new events", async () => {
  const store = new ObservableFakeStore();
  const failed = "node(9) deny(1) operation /failed-report";
  const subsequent = "node(10) deny(1) operation /subsequent";
  const diagnostics: string[] = [];
  let calls = 0;
  const dispose = subscribeToSandboxViolations(
    "command-1",
    (diagnostic) => {
      calls++;
      if (calls === 1) throw new Error("reporter failed");
      diagnostics.push(diagnostic);
    },
    store,
  );

  assert.doesNotThrow(() => store.addViolation("command-1", failed));
  const deadline = Date.now() + 1_000;
  while (calls < 1 && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(calls, 1);
  store.notify();
  assert.doesNotThrow(() => store.addViolation("command-1", subsequent));
  assert.doesNotThrow(dispose);
  assert.equal(calls, 2);
  assert.deepEqual(diagnostics, [annotation(subsequent)]);
});

test("command subscription bounds flood details and forgets ring-evicted identities", async () => {
  const store = new ObservableFakeStore();
  const diagnostics: string[] = [];
  const firstLine = `node(0) deny(1) operation /${"x".repeat(2_500)}`;
  const firstOccurrence: SandboxViolationEvent = {
    line: firstLine,
    command: "helper",
    encodedCommand: "encoded-helper",
    timestamp: new Date(0),
  };
  const dispose = subscribeToSandboxViolations(
    "command-1",
    (diagnostic) => diagnostics.push(diagnostic),
    store,
  );

  for (let index = 0; index < 350; index++) {
    store.addBatch("command-1", [index === 0 ? firstOccurrence : {
      line: `node(${index}) deny(1) operation /unique-${index}`,
      command: "helper",
      encodedCommand: "encoded-helper",
      timestamp: new Date(index),
    }]);
  }
  store.notify();
  await waitForDiagnostics(diagnostics, 1);

  const floodLines = diagnostics[0]!.split(EOL).slice(1, -1);
  const detailLines = floodLines.slice(0, -1);
  assert.equal(detailLines.length, 20);
  assert.ok(detailLines.every((line) => line.length <= 2_000));
  assert.equal(detailLines[0]!.length, 2_000);
  assert.match(detailLines[0]!, /… \[line truncated\]$/);
  assert.equal(floodLines.at(-1), "[330 additional occurrences omitted]");

  // The original identity fell out of the retained 100-occurrence snapshot.
  // Appending it again is a new occurrence, while unchanged notifications do
  // not replay any of the flood.
  store.notify();
  store.addBatch("command-1", [{ ...firstOccurrence }]);
  store.notify();
  dispose();
  assert.equal(diagnostics.length, 2);
  const rolloverLines = diagnostics[1]!.split(EOL).slice(1, -1);
  assert.equal(rolloverLines.length, 1);
  assert.equal(rolloverLines[0]!.length, 2_000);
  assert.match(rolloverLines[0]!, /… \[line truncated\]$/);
});

test("command subscription disposer flushes once and removes its listener idempotently", () => {
  const store = new ObservableFakeStore();
  const diagnostics: string[] = [];
  let reporting = false;
  const dispose = subscribeToSandboxViolations(
    "command-1",
    (diagnostic) => {
      diagnostics.push(diagnostic);
      if (!reporting) {
        reporting = true;
        store.addViolation("command-1", "node(12) deny(1) operation /reentrant-after-disposal");
      }
    },
    store,
  );
  const line = "node(11) deny(1) operation /visible-before-disposal";
  store.violationsByCommand.set("command-1", [{
    line,
    command: "helper",
    timestamp: new Date(20),
  }]);

  assert.doesNotThrow(dispose);
  assert.doesNotThrow(dispose);
  assert.deepEqual(diagnostics, [annotation(line)]);
  assert.equal(store.listeners.size, 0);
  assert.equal(store.unsubscribeCount, 1);

  store.addViolation("command-1", "node(13) deny(1) operation /late");
  assert.deepEqual(diagnostics, [annotation(line)]);
});

test("command subscription remains disposable when subscription setup fails", () => {
  const line = "node(14) deny(1) operation /subscription-failed";
  const store: SandboxViolationStoreObservable = {
    getViolationsForCommand() {
      return [{ line, command: "helper", timestamp: new Date(14) }];
    },
    subscribe() {
      throw new Error("subscribe failed");
    },
  };
  const diagnostics: string[] = [];
  const dispose = subscribeToSandboxViolations(
    "command-1",
    (diagnostic) => diagnostics.push(diagnostic),
    store,
  );

  assert.doesNotThrow(dispose);
  assert.doesNotThrow(dispose);
  assert.deepEqual(diagnostics, [annotation(line)]);
});

test("waits for delayed command violations beyond the old fixed delay", async () => {
  const store = new ObservableFakeStore();
  const line = "bash(123) deny(1) file-read-data /delayed";
  const waiting = waitForSandboxViolationDelivery("command-1", store);
  const delivery = setTimeout(() => store.addViolation("command-1", line), 45);

  try {
    await waiting;
    assert.equal(sandboxViolationAnnotation("command-1", store), annotation(line));
    assert.equal(store.listeners.size, 0);
    assert.equal(store.unsubscribeCount, 1);
  } finally {
    clearTimeout(delivery);
  }
});

test("resets the idle window for each burst of matching violations", async () => {
  const store = new ObservableFakeStore();
  const lines = [
    "bash(1) deny(1) operation /one",
    "bash(2) deny(1) operation /two",
    "bash(3) deny(1) operation /three",
  ];
  const waiting = waitForSandboxViolationDelivery("command-1", store);
  const deliveries = lines.map((line, index) => (
    setTimeout(() => store.addViolation("command-1", line), 5 + index * 20)
  ));

  try {
    await waiting;
    assert.equal(sandboxViolationAnnotation("command-1", store), annotation(...lines));
    assert.equal(store.listeners.size, 0);
    assert.equal(store.unsubscribeCount, 1);
  } finally {
    for (const delivery of deliveries) clearTimeout(delivery);
  }
});

test("unrelated command events do not reset a matching command's idle window", async () => {
  const store = new ObservableFakeStore();
  store.addViolation("command-1", "bash(1) deny(1) operation /target");
  const waiting = waitForSandboxViolationDelivery("command-1", store);
  let laterUnrelatedViolationDelivered = false;
  const firstDelivery = setTimeout(() => {
    store.addViolation("command-2", "bash(2) deny(1) operation /unrelated-one");
  }, 20);
  const laterDelivery = setTimeout(() => {
    laterUnrelatedViolationDelivered = true;
    store.addViolation("command-2", "bash(2) deny(1) operation /unrelated-two");
  }, 45);

  try {
    await waiting;
    assert.equal(laterUnrelatedViolationDelivered, false);
    assert.equal(store.listeners.size, 0);
    assert.equal(store.unsubscribeCount, 1);
  } finally {
    clearTimeout(firstDelivery);
    clearTimeout(laterDelivery);
  }
});

test("uses the hard deadline when no matching violation arrives", { timeout: 1_000 }, async () => {
  const store = new ObservableFakeStore();
  const waiting = waitForSandboxViolationDelivery("command-1", store);
  let passedTwoHundredMilliseconds = false;
  const marker = setTimeout(() => {
    passedTwoHundredMilliseconds = true;
  }, 200);
  const unrelatedDelivery = setTimeout(() => {
    store.addViolation("command-2", "bash(2) deny(1) operation /unrelated");
  }, 20);

  try {
    await waiting;
    assert.equal(passedTwoHundredMilliseconds, true);
    assert.equal(store.listeners.size, 0);
    assert.equal(store.unsubscribeCount, 1);
  } finally {
    clearTimeout(marker);
    clearTimeout(unrelatedDelivery);
  }
});
