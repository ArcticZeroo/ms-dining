interface ICacheItem<TValue> {
	value: TValue;
	expirationTime: number;
}

export class ExpiringCacheMap<TKey, TValue> {
	readonly #cache = new Map<TKey, ICacheItem<TValue>>();
	readonly #expirationTimeMs: number;
	readonly #fetchItem: (key: TKey) => Promise<TValue>;

	constructor(expirationTimeMs: number, fetchItem: (key: TKey) => Promise<TValue>) {
		this.#expirationTimeMs = expirationTimeMs;
		this.#fetchItem = fetchItem;
	}

	clean() {
		const now = Date.now();
		for (const [key, item] of this.#cache.entries()) {
			if (item.expirationTime <= now) {
				this.#cache.delete(key);
			}
		}
	}

	has(key: TKey): boolean {
		if (!this.#cache.has(key)) {
			return false;
		}

		const item = this.#cache.get(key)!;
		if (item.expirationTime <= Date.now()) {
			this.#cache.delete(key);
			return false;
		}

		return true;
	}

	async get(key: TKey): Promise<TValue> {
		if (this.has(key)) {
			return this.#cache.get(key)!.value;
		}

		const value = await this.#fetchItem(key);
		this.#cache.set(key, {
			value,
			expirationTime: Date.now() + this.#expirationTimeMs
		});

		return value;
	}

	set(key: TKey, value: TValue, fetchedAtTime: number = Date.now()): void {
		this.#cache.set(key, {
			value,
			expirationTime: fetchedAtTime + this.#expirationTimeMs
		});
	}

	delete(key: TKey): boolean {
		const isDeletingValidEntry = this.has(key);
		this.#cache.delete(key);
		return isDeletingValidEntry;
	}
}