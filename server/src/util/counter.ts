export class Counter<T> {
    readonly #counts = new Map<T, number>();

    increment(key: T) {
        const currentValue = this.count(key);
        this.#counts.set(key, currentValue + 1);
    }

    count(key: T): number {
        return this.#counts.get(key) ?? 0;
    }

    [Symbol.iterator]() {
        return this.#counts.entries();
    }

    keys() {
        return this.#counts.keys();
    }
}