import Semaphore from 'semaphore-async-await';

interface ILockedMapEntry<V> {
    lock: Semaphore.Lock;
    value: V;
}

export class LockedMap<K, V> {
    readonly #map: Map<K, ILockedMapEntry<V>> = new Map();
    #symbol = Symbol();

    get size(): number {
        return this.#map.size;
    }

    async update(key: K, callback: (value: V | undefined) => Promise<V>): Promise<V> {
        const currentSymbol = this.#symbol;

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

            if (currentSymbol === this.#symbol) {
                entry.value = newValue;
            }

            return newValue;
        } finally {
            entry.lock.release();
        }
    }

    clear() {
        this.#symbol = Symbol();
        this.#map.clear();
    }
}