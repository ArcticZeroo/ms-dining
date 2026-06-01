import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Duration from '@arcticzeroo/duration';
import { RetryAfterError } from '../../shared/util/error.js';
import { WorkerQueue } from './queue.js';
import { Nullable } from '../../shared/models/util.js';

/**
 * Concrete subclass for testing the base WorkerQueue behaviour.
 * Each test supplies a `workFn` callback to control what doWorkAsync does.
 */
class TestQueue extends WorkerQueue<string, string> {
    workFn: (entry: string) => Promise<void | Nullable<symbol>> = async () => {};

    constructor() {
        super({
            successPollInterval: new Duration({ milliseconds: 0 }),
            emptyPollInterval:   new Duration({ seconds: 60 }),
            failedPollInterval:  new Duration({ milliseconds: 0 }),
        });
    }

    protected getKey(entry: string): string {
        return entry;
    }

    async doWorkAsync(entry: string): Promise<void | Nullable<symbol>> {
        return this.workFn(entry);
    }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 50));

describe('WorkerQueue — RetryAfterError handling', () => {
    let queue: TestQueue;

    beforeEach(() => {
        queue = new TestQueue();
    });

    afterEach(() => {
        queue.stop();
    });

    it('re-queues the item and eventually processes it after a RetryAfterError', async () => {
        const processed: string[] = [];
        let callCount = 0;

        queue.workFn = async (entry) => {
            callCount++;
            if (entry === 'rate-limited-item' && callCount === 1) {
                throw new RetryAfterError(10); // 10ms retry
            }
            processed.push(entry);
        };

        queue.add('rate-limited-item');
        queue.start();

        // Wait enough for the retry-after (10ms) plus processing
        await flush();
        await flush();

        assert.deepEqual(processed, ['rate-limited-item'],
            'item must be retried and eventually processed');
        assert.equal(callCount, 2, 'doWorkAsync must be called twice (fail + retry)');
        assert.equal(queue.remainingItems, 0, 'queue must be empty after processing');
    });

    it('does not drop the rate-limited item from the map', async () => {
        let callCount = 0;

        queue.workFn = async (entry) => {
            callCount++;
            if (callCount <= 2) {
                throw new RetryAfterError(5);
            }
            // Third attempt succeeds
        };

        queue.add('persistent-item');
        queue.start();

        await flush();
        await flush();
        await flush();

        assert.equal(callCount, 3,
            'item must be retried on each RetryAfterError');
        assert.equal(queue.remainingItems, 0);
    });

    it('processes remaining items after the rate-limited item succeeds', async () => {
        const processed: string[] = [];
        let firstCallCount = 0;

        queue.workFn = async (entry) => {
            if (entry === 'first') {
                firstCallCount++;
                if (firstCallCount === 1) {
                    throw new RetryAfterError(5);
                }
            }
            processed.push(entry);
        };

        queue.add('first', 'second', 'third');
        queue.start();

        await flush();
        await flush();
        await flush();

        assert.deepEqual(processed, ['first', 'second', 'third'],
            'all items must be processed in order after rate limit clears');
    });

    it('non-rate-limit errors still drop the item (no re-queue)', async () => {
        const processed: string[] = [];

        queue.workFn = async (entry) => {
            if (entry === 'bad') {
                throw new Error('generic failure');
            }
            processed.push(entry);
        };

        queue.add('bad', 'good');
        queue.start();

        await flush();
        await flush();

        assert.deepEqual(processed, ['good'],
            'non-rate-limit failure must not re-queue the item');
        assert.equal(queue.remainingItems, 0);
    });

    it('QUEUE_SKIP_ENTRY still works correctly', async () => {
        const processed: string[] = [];

        queue.workFn = async (entry) => {
            processed.push(entry);
            if (entry === 'skip-me') {
                return WorkerQueue['QUEUE_SKIP_ENTRY'];
            }
        };

        queue.add('skip-me', 'after-skip');
        queue.start();

        await flush();
        await flush();

        assert.deepEqual(processed, ['skip-me', 'after-skip']);
    });
});
