export interface ExactEdit {
  oldText: string;
  newText: string;
}

export interface AppliedExactEdits {
  bom: string;
  lineEnding: "\n" | "\r\n";
  baseContent: string;
  newContent: string;
  finalContent: string;
}

export function detectLineEnding(content: string): "\n" | "\r\n" {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

export function normalizeToLf(content: string): string {
  return content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

export function restoreLineEndings(content: string, ending: "\n" | "\r\n"): string {
  return ending === "\n" ? content : content.replaceAll("\n", "\r\n");
}

function occurrenceIndexes(content: string, needle: string): number[] {
  if (needle.length === 0) return [];
  const indexes: number[] = [];
  for (let offset = 0; ; offset += 1) {
    const index = content.indexOf(needle, offset);
    if (index === -1) return indexes;
    indexes.push(index);
    offset = index;
  }
}

/** Apply unique, non-overlapping replacements matched against the same original content. */
export function applyExactEdits(rawContent: string, edits: ExactEdit[], displayPath: string): AppliedExactEdits {
  if (edits.length === 0) throw new Error("Edit tool input is invalid. edits must contain at least one replacement.");

  const bom = rawContent.startsWith("\ufeff") ? "\ufeff" : "";
  const withoutBom = bom ? rawContent.slice(1) : rawContent;
  const lineEnding = detectLineEnding(withoutBom);
  const baseContent = normalizeToLf(withoutBom);

  const matches = edits.map((edit, editIndex) => {
    const oldText = normalizeToLf(edit.oldText);
    const newText = normalizeToLf(edit.newText);
    if (oldText.length === 0) throw new Error(`Edit ${editIndex + 1} for ${displayPath} has empty oldText`);
    const indexes = occurrenceIndexes(baseContent, oldText);
    if (indexes.length === 0) throw new Error(`Could not find exact oldText for edit ${editIndex + 1} in ${displayPath}`);
    if (indexes.length > 1) {
      throw new Error(`oldText for edit ${editIndex + 1} is not unique in ${displayPath} (${indexes.length} matches)`);
    }
    return { editIndex, start: indexes[0]!, end: indexes[0]! + oldText.length, newText };
  });

  const ordered = [...matches].sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1]!;
    const current = ordered[index]!;
    if (current.start < previous.end) {
      throw new Error(
        `Edits ${previous.editIndex + 1} and ${current.editIndex + 1} overlap in the original content of ${displayPath}`,
      );
    }
  }

  let newContent = baseContent;
  for (const match of [...matches].sort((left, right) => right.start - left.start)) {
    newContent = newContent.slice(0, match.start) + match.newText + newContent.slice(match.end);
  }

  return {
    bom,
    lineEnding,
    baseContent,
    newContent,
    finalContent: bom + restoreLineEndings(newContent, lineEnding),
  };
}
