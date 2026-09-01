function compareCodePointOrder(left, right) {
  let leftOffset = 0;
  let rightOffset = 0;
  while (leftOffset < left.length && rightOffset < right.length) {
    const leftCodePoint = left.codePointAt(leftOffset);
    const rightCodePoint = right.codePointAt(rightOffset);
    if (leftCodePoint !== rightCodePoint) return leftCodePoint - rightCodePoint;
    leftOffset += leftCodePoint > 0xffff ? 2 : 1;
    rightOffset += rightCodePoint > 0xffff ? 2 : 1;
  }
  if (leftOffset < left.length) return 1;
  if (rightOffset < right.length) return -1;
  return 0;
}

export function compareLsNames(left, right) {
  const caseInsensitive = left.toLowerCase().localeCompare(right.toLowerCase());
  if (caseInsensitive !== 0) return caseInsensitive;
  return compareCodePointOrder(left, right);
}

class BoundedMaxHeap {
  constructor(capacity, compare) {
    this.capacity = capacity;
    this.compare = compare;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  get maximum() {
    return this.items[0];
  }

  add(value) {
    if (this.items.length < this.capacity) {
      this.items.push(value);
      this.#siftUp(this.items.length - 1);
      return true;
    }
    if (this.compare(value, this.items[0]) >= 0) return false;
    this.items[0] = value;
    this.#siftDown(0);
    return true;
  }

  toArray() {
    return [...this.items];
  }

  #siftUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[index], this.items[parent]) <= 0) return;
      [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]];
      index = parent;
    }
  }

  #siftDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let greatest = index;
      if (left < this.items.length && this.compare(this.items[left], this.items[greatest]) > 0) greatest = left;
      if (right < this.items.length && this.compare(this.items[right], this.items[greatest]) > 0) greatest = right;
      if (greatest === index) return;
      [this.items[index], this.items[greatest]] = [this.items[greatest], this.items[index]];
      index = greatest;
    }
  }
}

export async function selectLsEntries({ iterator, classify, limit, signal, onHeapSize }) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("ls selection limit must be a positive integer");
  const capacity = limit + 1;
  const compareEntries = (left, right) => compareLsNames(left.name, right.name);
  const heap = new BoundedMaxHeap(capacity, compareEntries);

  try {
    while (true) {
      signal?.throwIfAborted();
      const next = await iterator.next();
      signal?.throwIfAborted();
      if (next.done) break;

      const name = next.value?.name;
      if (typeof name !== "string") throw new Error("ls iterator entries must have string names");
      if (heap.size === capacity && compareLsNames(name, heap.maximum.name) >= 0) continue;

      signal?.throwIfAborted();
      const directory = await classify(next.value);
      signal?.throwIfAborted();
      if (directory === undefined || directory === null) continue;

      heap.add({ name, directory: Boolean(directory) });
      onHeapSize?.(heap.size);
    }
  } finally {
    try {
      if (typeof iterator.return === "function") await iterator.return();
    } catch {}
  }

  const retained = heap.toArray().sort(compareEntries);
  return {
    entries: retained.slice(0, limit),
    limitReached: retained.length > limit,
  };
}
