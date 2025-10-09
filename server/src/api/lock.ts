import * as SemaphoreModule from 'semaphore-async-await';
import { MaybePromise } from '../models/async.js';
import { logDebug } from '../util/log.js';

export class Lock {
	#queue: Array<() => void> = [];

	get queueLength() {
		return this.#queue.length;
	}

	#doNext() {
		const next = this.#queue[0];
		next?.();
	}

	acquire<T = void>(work: () => MaybePromise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const callback = async () => {
				try {
					resolve(await work());
				} catch (err) {
					reject(err);
				} finally {
					this.#queue.shift();
					this.#doNext();
				}
			}

			const canImmediatelyExecute = this.#queue.length === 0;
			this.#queue.push(callback);

			if (canImmediatelyExecute) {
				this.#doNext();
			}
		});
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