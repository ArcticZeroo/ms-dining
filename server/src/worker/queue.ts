import Duration from '@arcticzeroo/duration';
import { logDebug } from '../util/log.js';
import { Nullable } from '../models/util.js';

interface IWorkerQueueParams {
    successPollInterval: Duration;
    emptyPollInterval: Duration;
    failedPollInterval: Duration;
}

export abstract class WorkerQueue<TKey, TValue> {
    protected static readonly QUEUE_SKIP_ENTRY = Symbol('queue-skip-entry');

    readonly #successPollInterval: Duration;
    readonly #emptyPollInterval: Duration;
    readonly #failedPollInterval: Duration;
    readonly #entriesByKey: Map<TKey, TValue> = new Map<TKey, TValue>();
    readonly #keysInOrder: TKey[] = [];
    #runningSymbol: symbol | undefined;

    protected constructor({ successPollInterval, emptyPollInterval, failedPollInterval }: IWorkerQueueParams) {
        this.#successPollInterval = successPollInterval;
        this.#emptyPollInterval = emptyPollInterval;
        this.#failedPollInterval = failedPollInterval;
    }

    protected abstract getKey(entry: TValue): TKey;
    abstract doWorkAsync(entry: TValue): Promise<void | Nullable<symbol>>;

    public add(...entries: TValue[]) {
        for (const entry of entries) {
            const key = this.getKey(entry);
            if (this.#entriesByKey.has(key)) {
                continue;
            }

            this.#entriesByKey.set(key, entry);
            this.#keysInOrder.push(key);
        }
    }

    public start() {
        if (this.#runningSymbol) {
            return;
        }

        logDebug(this.constructor.name, 'Starting worker queue');

        const currentSymbol = Symbol();
        this.#runningSymbol = currentSymbol;

        const doQueueIteration = () => {
            if (this.#runningSymbol !== currentSymbol) {
                return;
            }

            if (this.#keysInOrder.length === 0) {
                setTimeout(doQueueIteration, this.#emptyPollInterval.inMilliseconds);
                return;
            }

            const key = this.#keysInOrder.shift();
            if (!key) {
                throw new Error('Queue entry key is missing');
            }

            const entry = this.#entriesByKey.get(key);
            if (!entry) {
                throw new Error('Queue entry is missing from map');
            }

            logDebug(this.constructor.name, 'Processing queue entry', key, ', remaining entries:', this.#keysInOrder.length);

            this.doWorkAsync(entry)
                .catch(() => setTimeout(doQueueIteration, this.#failedPollInterval.inMilliseconds))
                .then((result) => {
                    if (result === WorkerQueue.QUEUE_SKIP_ENTRY) {
                        // Immediately poke to next queue entry if we skipped this one
                        setTimeout(doQueueIteration, 0);
                    } else {
                        setTimeout(doQueueIteration, this.#successPollInterval.inMilliseconds);
                    }
                });
        }

        doQueueIteration();
    }
}