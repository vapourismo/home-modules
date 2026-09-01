function operationAbortedError(): Error {
  return new Error("Operation aborted");
}

interface Waiter {
  resolve: () => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
}

/** A FIFO concurrency limiter whose queued acquisitions can be aborted. */
export class AbortableLimiter {
  private active = 0;
  private readonly waiters: Waiter[] = [];
  readonly limit: number;

  constructor(limit: number) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Limiter size must be a positive integer");
    this.limit = limit;
  }

  async run<T>(signal: AbortSignal | undefined, operation: () => Promise<T>): Promise<T> {
    await this.acquire(signal);
    try {
      return await operation();
    } finally {
      this.active--;
      this.releaseNext();
    }
  }

  private acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(operationAbortedError());
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, signal };
      waiter.onAbort = () => {
        const index = this.waiters.indexOf(waiter);
        if (index === -1) return;
        this.waiters.splice(index, 1);
        reject(operationAbortedError());
      };
      signal?.addEventListener("abort", waiter.onAbort, { once: true });
      this.waiters.push(waiter);
    });
  }

  private releaseNext(): void {
    const waiter = this.waiters.shift();
    if (!waiter) return;
    if (waiter.signal && waiter.onAbort) waiter.signal.removeEventListener("abort", waiter.onAbort);
    this.active++;
    waiter.resolve();
  }

  get activeCount(): number {
    return this.active;
  }

  get queuedCount(): number {
    return this.waiters.length;
  }
}
