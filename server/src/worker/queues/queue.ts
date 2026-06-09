import Duration from '@arcticzeroo/duration';
import { isOfflineModeEnabled } from '../../shared/constants/env.js';
import { getNamespaceLogger, Logger } from '../../shared/util/log.js';
import { RetryAfterError } from '../../shared/util/error.js';
import { Nullable } from '../../shared/models/util.js';

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

        if (!isOfflineModeEnabled) {
            setInterval(() => this.#logStatus(), LOG_STATUS_INTERVAL.inMilliseconds).unref();
        }
    }

    #logStatus() {
        if (this.#keysInOrder.length === 0) {
            // this.#logger.debug('Queue is empty');
            return;
        }

        if (!this.#runningSymbol) {
            this.#logger.info('Queue is not running but has items waiting');
            return;
        }

        this.#logger.debug('Queue status:', this.#keysInOrder.length, 'items remaining');
    }

    protected abstract getKey(entry: TValue): TKey;

    abstract doWorkAsync(entry: TValue): Promise<void | Nullable<symbol>>;

    get remainingItems() {
        return this.#keysInOrder.length;
    }

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

    public stop() {
        this.#runningSymbol = undefined;
    }

    public start() {
        if (this.#runningSymbol) {
            return;
        }

        if (isOfflineModeEnabled) {
            this.#logger.info('Not starting worker queue because offline mode is enabled.');
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
                .then((result) => {
                    this.#entriesByKey.delete(key);
                    if (result === WorkerQueue.QUEUE_SKIP_ENTRY) {
                        setTimeout(doQueueIteration, 0);
                    } else {
                        setTimeout(doQueueIteration, this.#successPollInterval.inMilliseconds);
                    }
                })
                .catch((err) => {
                    if (err instanceof RetryAfterError) {
                        this.#keysInOrder.unshift(key);
                        this.#logger.info(`Rate limited, pausing queue for ${Math.ceil(err.retryAfterMs / 1000)}s`);
                        setTimeout(doQueueIteration, err.retryAfterMs);
                    } else {
                        this.#logger.debug('Failed to process queue entry', key, err);
                        this.#entriesByKey.delete(key);
                        setTimeout(doQueueIteration, this.#failedPollInterval.inMilliseconds);
                    }
                });
        };

        doQueueIteration();
    }
}