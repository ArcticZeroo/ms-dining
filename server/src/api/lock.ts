import * as SemaphoreModule from 'semaphore-async-await';
import { MaybePromise } from '../models/async.js';

export class Lock {
    #locked = false;
    #waiters: Array<() => void> = [];

    get queueLength() {
        return this.#waiters.length;
    }

    async acquire<T = void>(work: () => MaybePromise<T>): Promise<T> {
        if (this.#locked) {
            await new Promise<void>(resolve => this.#waiters.push(resolve));
        }
        this.#locked = true;
        try {
            return await work();
        } finally {
            const next = this.#waiters.shift();
            if (next != null) {
                next();
            } else {
                this.#locked = false;
            }
        }
    }
}

export class MultiLock {
    readonly #locksById = new Map<string, Lock>();

    async acquire<T = void>(id: string, work: () => MaybePromise<T>): Promise<T> {
        if (!this.#locksById.has(id)) {
            this.#locksById.set(id, new Lock());
        }

        const lock = this.#locksById.get(id)!;
        return lock.acquire(async () => {
            const result = await work();

            if (lock.queueLength === 0) {
                this.#locksById.delete(id);
            }

            return result;
        });
    }
}

// @ts-expect-error - this is insane
export const Semaphore: SemaphoreModule = SemaphoreModule.default.default;