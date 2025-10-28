import { MaybePromise } from '../models/async.js';

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