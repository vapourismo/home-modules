import assert from "node:assert/strict";
import test from "node:test";
import { escapePathForDisplay } from "../src/path-display.mjs";

test("path display escaping preserves printable Unicode and names common controls", () => {
  assert.equal(
    escapePathForDisplay("plain café 猫\ncarriage\rreturn\ttab"),
    "plain café 猫\\ncarriage\\rreturn\\ttab",
  );
  assert.equal(
    escapePathForDisplay("literal\\n versus newline\n"),
    "literal\\\\n versus newline\\n",
  );
});

test("path display escaping uses lowercase hex for all other C0, DEL, and C1 controls", () => {
  const codePoints = [
    ...Array.from({ length: 0x20 }, (_, value) => value).filter(
      (value) => value !== 0x09 && value !== 0x0a && value !== 0x0d,
    ),
    ...Array.from({ length: 0x21 }, (_, offset) => 0x7f + offset),
  ];
  const controls = String.fromCharCode(...codePoints);
  const expected = codePoints
    .map((codePoint) => `\\x${codePoint.toString(16).padStart(2, "0")}`)
    .join("");

  assert.equal(escapePathForDisplay(controls), expected);
  assert.equal(escapePathForDisplay("\x1b[2J\x7f\x80\x9f"), "\\x1b[2J\\x7f\\x80\\x9f");
});
