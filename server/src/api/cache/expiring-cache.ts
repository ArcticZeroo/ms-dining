import { LockedMap } from '../../util/map.js';
import Duration, { DurationOrMilliseconds } from '@arcticzeroo/duration';

interface ICacheItem<TValue> {
	value: TValue;
	expirationTime: number;
}

export class ExpiringCacheMap<TKey, TValue> {
	readonly #cache = new LockedMap<TKey, ICacheItem<TValue>>();
	readonly #expirationTimeMs: number;
	readonly #fetchItem: (key: TKey) => Promise<TValue>;

	constructor(expirationTime: DurationOrMilliseconds, fetchItem: (key: TKey) => Promise<TValue>) {
		this.#expirationTimeMs = Duration.fromDurationOrMilliseconds(expirationTime).inMilliseconds;
		this.#fetchItem = fetchItem;
	}

	async clean(): Promise<void> {
		const now = Date.now();
		for (const [key, item] of this.#cache.entries()) {
			if (item.expirationTime <= now) {
				await this.#cache.delete(key);
			}
		}
	}

	async has(key: TKey): Promise<boolean> {
		const item = this.#cache.update(key, (item) => {
			if (!item) {
				return undefined;
			}

			if (item.expirationTime <= Date.now()) {
				return undefined;
			}

			return item;
		});

		return item != null;
	}

	async get(key: TKey): Promise<TValue> {
		const item = await this.#cache.update(key, async (item) => {
			if (!item || item.expirationTime <= Date.now()) {
				const value = await this.#fetchItem(key);
				return {
					value,
					expirationTime: Date.now() + this.#expirationTimeMs
				};
			}

			return item;
		});

		return item.value;
	}

	async set(key: TKey, value: TValue, fetchedAtTime: number = Date.now()): Promise<void> {
		await this.#cache.update(key, () => ({
			value,
			expirationTime: fetchedAtTime + this.#expirationTimeMs
		}));
	}

	async delete(key: TKey): Promise<boolean> {
		let wasValidEntry = false;
		await this.#cache.update(key, (item) => {
			wasValidEntry = item != null && item.expirationTime > Date.now();
			return undefined;
		});
		return wasValidEntry;
	}
}