import Semaphore from 'semaphore-async-await';

interface ILockedMapEntry<V> {
    lock: Semaphore.Lock;
    value: V | undefined;
}

export class LockedMap<K, V> {
    readonly #map: Map<K, ILockedMapEntry<V>> = new Map();
    #symbol = Symbol();

    get size(): number {
        return this.#map.size;
    }

    async update(key: K, callback: (value: V | undefined) => Promise<V>): Promise<V> {
        const currentMapSymbol = this.#symbol;

        if (!this.#map.has(key)) {
            this.#map.set(key, {
                lock: new Semaphore.Lock(),
                value: undefined
            });
        }

        const entry = this.#map.get(key)!;

        try {
            await entry.lock.acquire();

            const newValue = await callback(entry.value);

            if (currentMapSymbol === this.#symbol) {
                entry.value = newValue;
            }

            return newValue;
        } finally {
            entry.lock.release();
        }
    }

    delete(key: K) {
        // Anyone currently waiting on update will still be able to insert into the entry, the entry just will no longer
        // be referenced here. Maybe in the future we'll throw an error so that update callers don't think it succeeded?
        this.#map.delete(key);
    }

    clear() {
        this.#symbol = Symbol();
        this.#map.clear();
    }
}