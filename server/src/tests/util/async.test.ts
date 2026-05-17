import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    ICancellationToken,
    PromiseCancelledException,
    runPromiseWithRetries,
} from '../../util/async.js';

// 37e02a6: the loop body must use `return await promise(i)` rather than
// `return promise(i)`. Without the await, rejections from the inner promise
// escape the surrounding try/catch and skip the retry logic entirely.

describe('runPromiseWithRetries', () => {
    it('returns immediately on first success without retrying', async () => {
        let calls = 0;
        const result = await runPromiseWithRetries(async () => {
            calls++;
            return 'ok';
        }, 3);

        assert.equal(calls, 1);
        assert.equal(result, 'ok');
    });

    it('catches a rejection and retries (regression: must `return await`)', async () => {
        const indices: number[] = [];
        const result = await runPromiseWithRetries(async (i) => {
            indices.push(i);
            if (i === 0) {
                throw new Error('transient');
            }
            return `done@${i}`;
        }, 3);

        // Before the `return await` fix, the rejection on i=0 escaped the
        // catch block and the function rejected without retrying.
        assert.deepEqual(indices, [0, 1]);
        assert.equal(result, 'done@1');
    });

    it('respects the maximum retry count and rethrows the final error', async () => {
        const indices: number[] = [];
        await assert.rejects(
            runPromiseWithRetries(async (i) => {
                indices.push(i);
                throw new Error(`fail-${i}`);
            }, 2),
            /fail-2/
        );

        assert.deepEqual(indices, [0, 1, 2], 'should attempt exactly retries+1 times');
    });

    it('performs only one attempt when retries=0', async () => {
        let calls = 0;
        await assert.rejects(
            runPromiseWithRetries(async () => {
                calls++;
                throw new Error('once');
            }, 0),
            /once/
        );

        assert.equal(calls, 1);
    });

    it('does not delay after the final failure', async () => {
        const start = Date.now();
        await assert.rejects(
            runPromiseWithRetries(
                async () => { throw new Error('boom'); },
                0,    // single attempt
                500   // would add a noticeable delay if applied wrongly
            ),
            /boom/
        );
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 200, `expected no delay after final failure, took ${elapsed}ms`);
    });

    it('delays only between retries, not after the final failure', async () => {
        const delayMs = 60;
        const retries = 2; // 3 attempts -> at most 2 inter-attempt delays
        const start = Date.now();
        await assert.rejects(
            runPromiseWithRetries(
                async () => { throw new Error('boom'); },
                retries,
                delayMs
            ),
            /boom/
        );
        const elapsed = Date.now() - start;
        const minimumExpected = delayMs * retries;        // 120ms
        const maximumExpected = delayMs * (retries + 1);  // 180ms (one extra delay would land here)
        assert.ok(
            elapsed >= minimumExpected - 20,
            `expected >= ${minimumExpected}ms (delays between retries), got ${elapsed}ms`
        );
        assert.ok(
            elapsed < maximumExpected + 80,
            `expected < ${maximumExpected + 80}ms (no extra delay after final failure), got ${elapsed}ms`
        );
    });

    it('throws PromiseCancelledException when cancellation is set before the first attempt', async () => {
        let calls = 0;
        const cancellation: ICancellationToken = { isCancelled: true };

        await assert.rejects(
            runPromiseWithRetries(
                async () => {
                    calls++;
                    return 'never';
                },
                3,
                undefined,
                cancellation
            ),
            (err: Error) => err instanceof PromiseCancelledException
        );

        assert.equal(calls, 0, 'cancellation should short-circuit before invoking the work');
    });

    it('rethrows the original error and stops retrying when cancelled after a failed attempt', async () => {
        const indices: number[] = [];
        const cancellation: ICancellationToken = { isCancelled: false };

        await assert.rejects(
            runPromiseWithRetries(
                async (i) => {
                    indices.push(i);
                    cancellation.isCancelled = true;
                    throw new Error('inner-fail');
                },
                3,
                undefined,
                cancellation
            ),
            /inner-fail/
        );

        assert.deepEqual(indices, [0], 'should not retry after cancellation flips mid-attempt');
    });

    it('does not pause when delayMs is unset, even with retries', async () => {
        const start = Date.now();
        await assert.rejects(
            runPromiseWithRetries(
                async () => { throw new Error('quick'); },
                3
            ),
            /quick/
        );
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 100, `expected near-instant when no delayMs, took ${elapsed}ms`);
    });
});
