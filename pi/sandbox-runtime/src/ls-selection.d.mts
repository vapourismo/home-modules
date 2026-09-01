export interface LsSelectionEntry {
  name: string;
  directory: boolean;
}

export interface SelectLsEntriesOptions<T> {
  iterator: AsyncIterator<T>;
  classify: (value: T) => boolean | null | undefined | Promise<boolean | null | undefined>;
  limit: number;
  signal?: AbortSignal;
  onHeapSize?: (size: number) => void;
}

export interface LsSelectionResult {
  entries: LsSelectionEntry[];
  limitReached: boolean;
}

export function compareLsNames(left: string, right: string): number;
export function selectLsEntries<T>(
  options: SelectLsEntriesOptions<T>,
): Promise<LsSelectionResult>;
