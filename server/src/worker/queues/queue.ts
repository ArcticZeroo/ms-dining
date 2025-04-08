import Duration from '@arcticzeroo/duration';
import { getNamespaceLogger, logDebug, Logger, logInfo } from '../../util/log.js';
import { Nullable } from '../../models/util.js';

const LOG_STATUS_INTERVAL = new Duration({ minutes: 1 });

interface IWorkerQueueParams {
    successPollInterval?: Duration;
    emptyPollInterval: Duration;
    failedPollInterval?: Duration;
}

export abstract class WorkerQueue<TKey, TValue> {
    protected static readonly QUEUE_SKIP_ENTRY = Symbol('queue-skip-entry');

    readonly #logger: Logger;
    readonly #successPollInterval: Duration;
    readonly #emptyPollInterval: Duration;
    readonly #failedPollInterval: Duration;
    readonly #entriesByKey: Map<TKey, TValue> = new Map<TKey, TValue>();
    readonly #keysInOrder: TKey[] = [];
    #runningSymbol: symbol | undefined;

    protected constructor({ successPollInterval, emptyPollInterval, failedPollInterval }: IWorkerQueueParams) {
        this.#successPollInterval = successPollInterval ?? new Duration({ milliseconds: 0 });
        this.#failedPollInterval = failedPollInterval ?? new Duration({ milliseconds: 0 });
        this.#emptyPollInterval = emptyPollInterval;
        this.#logger = getNamespaceLogger(this.constructor.name);

        setInterval(() => this.#logStatus(), LOG_STATUS_INTERVAL.inMilliseconds);
    }

    #logStatus() {
        if (this.#keysInOrder.length === 0) {
            this.#logger.debug('Queue is empty');
            return;
        }

        if (!this.#runningSymbol) {
            this.#logger.info('Queue is not running but has items waiting');
            return;
        }

        this.#logger.debug('Queue status:', this.#keysInOrder.length, 'items remaining');
    }

    protected abstract getKey(entry: TValue): TKey;
    protected isWorkNeeded(entry: TValue): boolean {
        return true;
    }
    abstract doWorkAsync(entry: TValue): Promise<void | Nullable<symbol>>;

    get remainingItems() {
        return this.#keysInOrder.length;
    }

    public add(...entries: TValue[]) {
        for (const entry of entries) {
            if (!this.isWorkNeeded(entry)) {
                continue;
            }

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

        this.#logger.debug('Starting worker queue');

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

            // this.#logger.debug('Processing queue entry', key, ', remaining entries:', this.#keysInOrder.length);

            this.doWorkAsync(entry)
                .catch((err) => {
                    this.#logger.debug('Failed to process queue entry', key, err);
                    setTimeout(doQueueIteration, this.#failedPollInterval.inMilliseconds);
                })
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