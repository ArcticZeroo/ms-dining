import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RetryAfterError } from '../../shared/util/error.js';
import { runPromiseWithRetries } from '../../shared/util/async.js';

describe('runPromiseWithRetries — RetryAfterError bypass', () => {
    it('does not retry when the first attempt throws RetryAfterError', async () => {
        let callCount = 0;

        await assert.rejects(
            () => runPromiseWithRetries(async () => {
                callCount++;
                throw new RetryAfterError(1000);
            }, 3),
            (err) => err instanceof RetryAfterError,
        );

        assert.equal(callCount, 1,
            'must not retry — RetryAfterError should propagate immediately');
    });

    it('preserves the retryAfterMs value on the thrown error', async () => {
        await assert.rejects(
            () => runPromiseWithRetries(async () => {
                throw new RetryAfterError(42_000, 'rate limited');
            }, 5),
            (err) => {
                assert.ok(err instanceof RetryAfterError);
                assert.equal(err.retryAfterMs, 42_000);
                assert.ok(err.message.includes('rate limited'));
                return true;
            },
        );
    });

    it('still retries normal errors as before', async () => {
        let callCount = 0;

        const result = await runPromiseWithRetries(async () => {
            callCount++;
            if (callCount < 3) {
                throw new Error('transient');
            }
            return 'ok';
        }, 3);

        assert.equal(result, 'ok');
        assert.equal(callCount, 3, 'should have retried twice before succeeding');
    });
});
