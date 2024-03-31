import Duration from '@arcticzeroo/duration';
import { logDebug } from '../../util/log.js';
import { Nullable } from '../../models/util.js';

interface IWorkerQueueParams {
    successPollInterval: Duration;
    emptyPollInterval: Duration;
    failedPollInterval: Duration;
}

export abstract class WorkerQueue<T> {
    protected static readonly QUEUE_SKIP_ENTRY = Symbol('queue-skip-entry');

    readonly #successPollInterval: Duration;
    readonly #emptyPollInterval: Duration;
    readonly #failedPollInterval: Duration;
    readonly #entries: T[] = [];
    #runningSymbol: symbol | undefined;

    protected constructor({ successPollInterval, emptyPollInterval, failedPollInterval }: IWorkerQueueParams) {
        this.#successPollInterval = successPollInterval;
        this.#emptyPollInterval = emptyPollInterval;
        this.#failedPollInterval = failedPollInterval;
    }

    abstract doWorkAsync(entry: T): Promise<void | Nullable<symbol>>;

    public add(...entries: T[]) {
        this.#entries.push(...entries);
    }

    public start() {
        if (this.#runningSymbol) {
            return;
        }

        const currentSymbol = Symbol();
        this.#runningSymbol = currentSymbol;

        const doQueueIteration = () => {
            if (this.#runningSymbol !== currentSymbol) {
                return;
            }

            if (this.#entries.length === 0) {
                setTimeout(doQueueIteration, this.#emptyPollInterval.inMilliseconds);
                return;
            }

            logDebug('Processing queue entry, remaining items:', this.#entries.length);
            const entry = this.#entries.shift();

            if (!entry) {
                throw new Error('Queue entry is missing');
            }

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