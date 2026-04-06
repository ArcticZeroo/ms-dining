import { MaybePromise } from '../../models/async.js';

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

export class Semaphore {
	readonly #maxConcurrency: number | undefined;
	#currentConcurrency = 0;
	#waiters: Array<() => void> = [];

	constructor(maxConcurrency?: number) {
		if (maxConcurrency != null && maxConcurrency <= 0) {
			throw new RangeError('maxConcurrency must be a positive integer');
		}

		this.#maxConcurrency = maxConcurrency;
	}

	async acquire<T = void>(work: () => MaybePromise<T>): Promise<T> {
		if (this.#maxConcurrency == null) {
			return work();
		}

		if (this.#currentConcurrency >= this.#maxConcurrency) {
			await new Promise<void>(resolve => this.#waiters.push(resolve));
		}
		this.#currentConcurrency++;
		try {
			return await work();
		} finally {
			this.#currentConcurrency--;
			const next = this.#waiters.shift();
			next?.();
		}
	}
}
