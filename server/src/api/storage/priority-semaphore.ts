import { DbPriority } from './db-context.js';

const PRIORITY_ORDER: DbPriority[] = ['critical', 'normal', 'background'];

/**
 * A FIFO-within-priority semaphore: at most `maxConcurrent` callers may hold
 * a permit at once; while at the limit, new callers queue and are released
 * in priority order (critical > normal > background) — within a priority,
 * waiters are served FIFO.
 *
 * `maxConcurrent: 1` is equivalent to a priority lock.
 */
export class PrioritySemaphore {
    readonly #maxConcurrent: number;
    #inFlight = 0;
    readonly #waiters: Record<DbPriority, Array<() => void>> = {
        critical:   [],
        normal:     [],
        background: [],
    };

    constructor(maxConcurrent: number = 1) {
        if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
            throw new Error(`PrioritySemaphore maxConcurrent must be a positive integer, got ${maxConcurrent}`);
        }
        this.#maxConcurrent = maxConcurrent;
    }

    get maxConcurrent(): number {
        return this.#maxConcurrent;
    }

    get inFlight(): number {
        return this.#inFlight;
    }

    get queueDepth(): number {
        return this.#waiters.critical.length + this.#waiters.normal.length + this.#waiters.background.length;
    }

    async acquire<T>(priority: DbPriority, callback: () => Promise<T>): Promise<T> {
        await this.#acquireInternal(priority);
        try {
            return await callback();
        } finally {
            this.#release();
        }
    }

    #acquireInternal(priority: DbPriority): Promise<void> {
        if (this.#inFlight < this.#maxConcurrent) {
            this.#inFlight++;
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            this.#waiters[priority].push(resolve);
        });
    }

    #release(): void {
        for (const priority of PRIORITY_ORDER) {
            const next = this.#waiters[priority].shift();
            if (next != null) {
                // Hand off the permit directly: in-flight count stays the same.
                next();
                return;
            }
        }

        this.#inFlight--;
    }
}
