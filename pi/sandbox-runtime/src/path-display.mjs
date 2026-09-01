/**
 * Escape filesystem path text for safe, unquoted human-readable output.
 *
 * Printable characters and non-ASCII Unicode are preserved. Backslashes are
 * doubled, LF/CR/tab use named escapes, and other C0, DEL, and C1 controls use
 * lowercase hexadecimal escapes.
 */
export function escapePathForDisplay(value) {
  return value.replace(/[\\\u0000-\u001f\u007f-\u009f]/g, (character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint === 0x5c) return "\\\\";
    if (codePoint === 0x0a) return "\\n";
    if (codePoint === 0x0d) return "\\r";
    if (codePoint === 0x09) return "\\t";
    return `\\x${codePoint.toString(16).padStart(2, "0")}`;
  });
}
