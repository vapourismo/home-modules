import assert from "node:assert/strict";
import test from "node:test";
import { compareLsNames, selectLsEntries } from "../src/ls-selection.mjs";

type Candidate = {
  name: string;
  kind?: "file" | "directory" | "directory-symlink" | "inaccessible";
};

function controlledIterator(candidates: Candidate[], options: {
  beforeNext?: (index: number) => void;
  returnError?: Error;
} = {}) {
  let index = 0;
  let returnCalls = 0;
  const iterator: AsyncIterator<Candidate> = {
    async next() {
      options.beforeNext?.(index);
      if (index >= candidates.length) return { done: true, value: undefined };
      return { done: false, value: candidates[index++]! };
    },
    async return() {
      returnCalls++;
      if (options.returnError) throw options.returnError;
      return { done: true, value: undefined };
    },
  };
  return { iterator, get returnCalls() { return returnCalls; } };
}

async function select(candidates: Candidate[], limit: number) {
  const source = controlledIterator(candidates);
  const result = await selectLsEntries({
    iterator: source.iterator,
    limit,
    async classify(candidate: Candidate) {
      if (candidate.kind === "inaccessible") return undefined;
      return candidate.kind === "directory" || candidate.kind === "directory-symlink";
    },
  });
  assert.equal(source.returnCalls, 1);
  return result;
}

test("selector returns the alphabetically first names from reverse and late-arriving input", async () => {
  const result = await select(
    ["zulu", "yankee", "xray", "whiskey", "victor", "alpha", ".hidden"].map((name) => ({ name })),
    3,
  );

  assert.deepEqual(result, {
    entries: [
      { name: ".hidden", directory: false },
      { name: "alpha", directory: false },
      { name: "victor", directory: false },
    ],
    limitReached: true,
  });
});

test("selector skips inaccessible entries and preserves directory classifications", async () => {
  const result = await select([
    { name: "broken", kind: "inaccessible" },
    { name: "plain", kind: "file" },
    { name: ".dotfile", kind: "file" },
    { name: "folder-link", kind: "directory-symlink" },
    { name: "folder", kind: "directory" },
  ], 4);

  assert.deepEqual(result, {
    entries: [
      { name: ".dotfile", directory: false },
      { name: "folder", directory: true },
      { name: "folder-link", directory: true },
      { name: "plain", directory: false },
    ],
    limitReached: false,
  });
});

test("name comparator adds deterministic code-point ordering for case ties", async () => {
  const names = ["alpha", "aLPhA", "Alpha", "ALPHA"];
  const expected = ["ALPHA", "Alpha", "aLPhA", "alpha"];

  assert.deepEqual([...names].sort(compareLsNames), expected);
  const result = await select(names.map((name) => ({ name })), names.length);
  assert.deepEqual(result.entries.map((entry) => entry.name), expected);
});

test("selector distinguishes an exact fit from one extra eligible entry", async () => {
  const exact = await select(["charlie", "alpha", "bravo"].map((name) => ({ name })), 3);
  assert.deepEqual(exact.entries.map((entry) => entry.name), ["alpha", "bravo", "charlie"]);
  assert.equal(exact.limitReached, false);

  const truncated = await select(["delta", "charlie", "alpha", "bravo"].map((name) => ({ name })), 3);
  assert.deepEqual(truncated.entries.map((entry) => entry.name), ["alpha", "bravo", "charlie"]);
  assert.equal(truncated.limitReached, true);
});

test("selector bounds its heap and skips classification of noncompetitive names", async () => {
  const source = controlledIterator(["alpha", "bravo", "charlie", "aardvark", "zulu", "yankee"]
    .map((name) => ({ name })));
  const classified: string[] = [];
  let maximumHeapSize = 0;
  const result = await selectLsEntries({
    iterator: source.iterator,
    limit: 2,
    async classify(candidate: Candidate) {
      classified.push(candidate.name);
      return false;
    },
    onHeapSize(size: number) {
      maximumHeapSize = Math.max(maximumHeapSize, size);
    },
  });

  assert.deepEqual(result.entries.map((entry) => entry.name), ["aardvark", "alpha"]);
  assert.equal(result.limitReached, true);
  assert.equal(maximumHeapSize, 3);
  assert.ok(maximumHeapSize <= 2 + 1);
  assert.deepEqual(classified, ["alpha", "bravo", "charlie", "aardvark"]);
  assert.equal(source.returnCalls, 1);
});

test("selector observes cancellation during scanning and returns the iterator", async () => {
  const controller = new AbortController();
  const source = controlledIterator(
    ["alpha", "bravo", "charlie"].map((name) => ({ name })),
    { beforeNext(index) { if (index === 1) controller.abort(); } },
  );

  await assert.rejects(
    selectLsEntries({
      iterator: source.iterator,
      limit: 2,
      signal: controller.signal,
      async classify() { return false; },
    }),
    /abort/i,
  );
  assert.equal(source.returnCalls, 1);
});

test("iterator cleanup errors do not mask selection success or failure", async () => {
  const successful = controlledIterator([{ name: "alpha" }], { returnError: new Error("cleanup failed") });
  const result = await selectLsEntries({
    iterator: successful.iterator,
    limit: 1,
    async classify() { return false; },
  });
  assert.deepEqual(result.entries, [{ name: "alpha", directory: false }]);
  assert.equal(successful.returnCalls, 1);

  const failed = controlledIterator([{ name: "alpha" }], { returnError: new Error("cleanup failed") });
  await assert.rejects(
    selectLsEntries({
      iterator: failed.iterator,
      limit: 1,
      async classify() { throw new Error("classification failed"); },
    }),
    /classification failed/,
  );
  assert.equal(failed.returnCalls, 1);
});
