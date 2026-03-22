import { Lock } from './lock.js';
import { MaybePromise } from '../../models/async.js';
import { setInterval } from 'node:timers';
import { logError } from '../../util/log.js';
import Duration, { DurationOrMilliseconds } from '@arcticzeroo/duration';

export interface ILockedMap<K, V> {
	size: number;
	entries(): IterableIterator<[K, V]>;
	has(key: K): Promise<boolean>;
	update<TReturn extends V | undefined>(key: K, callback: (value: V | undefined) => MaybePromise<TReturn>): Promise<TReturn>;
	getOrInsert(key: K, callback: () => MaybePromise<V>): Promise<V>;
	peek<TReturn>(key: K, callback: (value: V | undefined) => TReturn): Promise<TReturn>;
	delete(key: K): Promise<void>;
	deleteWhere(shouldDelete: (key: K, value: V) => boolean): Promise<void>;
}

export class LockedMap<K, V> implements ILockedMap<K, V> {
    readonly #locks: Map<K, Lock> = new Map();
    readonly #values: Map<K, V> = new Map();

    constructor(initialState?: Iterable<[K, V]>) {
        if (initialState) {
            for (const [key, value] of initialState) {
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

	async getOrInsert(key: K, callback: () => MaybePromise<V>): Promise<V> {
		return this.update(key, async (value) => {
			if (value) {
				return value;
			}

			return callback();
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

    async deleteWhere(shouldDelete: (key: K, value: V) => boolean): Promise<void> {
        const keysToDelete: K[] = [];
        for (const [key, value] of this.#values.entries()) {
            if (shouldDelete(key, value)) {
                keysToDelete.push(key);
            }
        }

        await Promise.all(keysToDelete.map(key => this.delete(key)));
    }

	async peek<TReturn>(key: K, callback: (value: V | undefined) => TReturn): Promise<TReturn> {
		const lock = this.#locks.get(key);
		if (!lock) {
			return callback(undefined);
		}

		return lock.acquire(() => {
			const value = this.#values.get(key);
			return callback(value);
		});
	}
}

interface IExpiringEntry<V> {
	value: V;
	expirationTime: number
}

export class LockedExpiringMap<K, V> implements ILockedMap<K, V> {
	readonly #expirationTimeMs: number;
	readonly #map: LockedMap<K, IExpiringEntry<V>>;

	constructor(expirationTime: DurationOrMilliseconds, initialState?: Map<K, V>) {
		this.#expirationTimeMs = Duration.fromDurationOrMilliseconds(expirationTime).inMilliseconds;
		const expiringInitialState = Array.from(initialState ?? [])
			.map(([key, value]) => [key, { value, expirationTime: Date.now() + this.#expirationTimeMs } satisfies IExpiringEntry<V>] as [K, IExpiringEntry<V>]);
		this.#map = new LockedMap<K, IExpiringEntry<V>>(expiringInitialState);

		setInterval(() => {
			this.#map.deleteWhere((_, entry) => {
				return entry.expirationTime < Date.now();
			}).catch(err => logError(`Failed to delete expired entries from LockedExpiringMap: ${err}`));
		});
	}

	async update<TReturn extends V | undefined>(key: K, callback: (value: V | undefined) => MaybePromise<TReturn>): Promise<TReturn> {
		const result = await this.#map.update(key, async (entry) => {
			const now = Date.now();
			if (entry && entry.expirationTime <= now) {
				entry = undefined;
			}

			const value = entry?.value;
			const newValue = await callback(value);

			if (newValue === undefined) {
				return undefined;
			}

			return { value: newValue, expirationTime: now + this.#expirationTimeMs } satisfies IExpiringEntry<V>;
		});

		return result?.value as TReturn;
	}

	getOrInsert(key: K, callback: () => MaybePromise<V>): Promise<V> {
		return this.update(key, async (value) => {
			if (value) {
				return value;
			}

			return callback();
		});
	}

	get size() {
		return this.#map.size;
	}

	delete(key: K): Promise<void> {
		return this.#map.delete(key);
	}

	deleteWhere(shouldDelete: (key: K, value: V) => boolean): Promise<void> {
		return this.#map.deleteWhere((key, entry) => {
			return entry.expirationTime <= Date.now() || shouldDelete(key, entry.value);
		});
	}

	entries(): IterableIterator<[K, V]> {
		const iterator = this.#map.entries();
		const entriesGenerator = function*() {
			for (const [key, entry] of iterator) {
				if (entry.expirationTime > Date.now()) {
					yield [key, entry.value] as [K, V];
				}
			}
		}
		return entriesGenerator();
	}

	peek<TReturn>(key: K, callback: (value: (V | undefined)) => TReturn): Promise<TReturn> {
		return this.#map.peek(key, (entry) => {
			if (!entry || entry.expirationTime <= Date.now()) {
				return callback(undefined);
			}

			return callback(entry.value);
		});
	}

	has(key: K): Promise<boolean> {
		return this.#map.peek(key, (entry) => {
			// Peek will send undefined if the key doesn't exist or if it has expired, so treat both cases as "not found"
			return entry != null;
		});
	}
}