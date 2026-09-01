import assert from "node:assert/strict";
import test from "node:test";
import { applyExactEdits } from "../src/edit.ts";
import { readPathCandidates, resolveSyntacticPath } from "../src/paths.ts";

test("paths resolve syntactically without filesystem-dependent canonicalization", () => {
  assert.equal(resolveSyntacticPath("@src/../file.txt", "/workspace", "/home/test"), "/workspace/file.txt");
  assert.equal(resolveSyntacticPath("~/secret.txt", "/workspace", "/home/test"), "/home/test/secret.txt");
  assert.equal(resolveSyntacticPath("/missing/../target", "/workspace", "/home/test"), "/target");
});

test("path resolution preserves significant ASCII whitespace", () => {
  assert.equal(resolveSyntacticPath(" report.txt", "/workspace", "/home/test"), "/workspace/ report.txt");
  assert.equal(resolveSyntacticPath("report.txt ", "/workspace", "/home/test"), "/workspace/report.txt ");
  assert.equal(resolveSyntacticPath("   ", "/workspace", "/home/test"), "/workspace/   ");
  assert.equal(resolveSyntacticPath("/workspace/report.txt ", "/ignored", "/home/test"), "/workspace/report.txt ");
  assert.equal(resolveSyntacticPath(" @report.txt", "/workspace", "/home/test"), "/workspace/ @report.txt");
});

test("path resolution normalizes Pi-compatible Unicode spaces", () => {
  const unicodeSpaces = [
    "\u00a0",
    ...Array.from({ length: 0x200a - 0x2000 + 1 }, (_, index) => String.fromCodePoint(0x2000 + index)),
    "\u202f",
    "\u205f",
    "\u3000",
  ];
  for (const unicodeSpace of unicodeSpaces) {
    assert.equal(resolveSyntacticPath(`${unicodeSpace}report.txt`, "/workspace", "/home/test"), "/workspace/ report.txt");
  }
});

test("read candidates include macOS spelling variants without probing", () => {
  const candidates = readPathCandidates("Capture 1.00 PM.png", "/workspace", "/home/test");
  assert.equal(candidates[0], "/workspace/Capture 1.00 PM.png");
  assert.ok(candidates.some((candidate) => candidate.includes("\u202fPM")));
});

test("exact edit requires unique original matches", () => {
  assert.throws(
    () => applyExactEdits("same\nsame\n", [{ oldText: "same", newText: "new" }], "file.txt"),
    /not unique/,
  );
  assert.throws(
    () => applyExactEdits("one\ntwo\n", [{ oldText: "missing", newText: "new" }], "file.txt"),
    /Could not find exact/,
  );
});

test("exact edit rejects overlaps matched against original content", () => {
  assert.throws(
    () => applyExactEdits(
      "alpha beta gamma",
      [
        { oldText: "alpha beta", newText: "one" },
        { oldText: "beta gamma", newText: "two" },
      ],
      "file.txt",
    ),
    /overlap/,
  );
});

test("exact edit preserves BOM and LF", () => {
  const result = applyExactEdits("\ufeffBEFORE\nnext\n", [{ oldText: "BEFORE", newText: "AFTER" }], "file.txt");
  assert.equal(result.finalContent, "\ufeffAFTER\nnext\n");
  assert.equal(result.lineEnding, "\n");
});

test("exact edit preserves CRLF and normalizes replacement endings", () => {
  const result = applyExactEdits("BEFORE\r\nnext\r\n", [{ oldText: "BEFORE\nnext", newText: "AFTER\nlast" }], "file.txt");
  assert.equal(result.finalContent, "AFTER\r\nlast\r\n");
  assert.equal(result.lineEnding, "\r\n");
});
