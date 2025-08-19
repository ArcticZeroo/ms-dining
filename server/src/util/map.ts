import { Lock } from '../api/lock.js';
import { MaybePromise } from '../models/async.js';

export class LockedMap<K, V> {
    readonly #locks: Map<K, Lock> = new Map();
    readonly #values: Map<K, V> = new Map();

	constructor(initialState?: Map<K, V>) {
		if (initialState) {
			for (const [key, value] of initialState.entries()) {
				this.#locks.set(key, new Lock());
				this.#values.set(key, value);
			}
		}
	}

    get size(): number {
        return this.#locks.size;
    }

    entries()  {
        return this.#values.entries();
    }

    async has(key: K): Promise<boolean> {
        if (!this.#locks.has(key)) {
            return false;
        }

        // There might be a pending delete for the key,
        // so try to acquire it and then check again.
        const lock = this.#locks.get(key)!;
        return lock.acquire(() => this.#locks.has(key));
    }

    async update<TReturn extends V | undefined>(key: K, callback: (value: V | undefined) => MaybePromise<TReturn>): Promise<TReturn> {
        if (!this.#locks.has(key)) {
            this.#locks.set(key, new Lock());
        }

        const lock = this.#locks.get(key)!;

        return lock.acquire(async () => {
            const value = this.#values.get(key);
            const newValue = await callback(value);

            if (newValue === undefined) {
                this.#locks.delete(key);
                this.#values.delete(key);
            } else {
                this.#values.set(key, newValue);
            }

            return newValue;
        });
    }

    async delete(key: K) {
        const lock = this.#locks.get(key);
        if (!lock) {
            return;
        }

        return lock.acquire(() => {
            this.#locks.delete(key);
            this.#values.delete(key);
        });
    }
}