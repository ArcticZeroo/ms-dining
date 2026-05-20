import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rethrowWithoutStatus } from '../../shared/util/error.js';

// 0430035: third-party SDK errors (OpenAI, Anthropic) set `.status` to the
// upstream HTTP status (e.g. 429 for rate limits). Koa reads `err.status` as
// the response code, so those statuses leaked to the client. rethrowWithoutStatus
// re-throws as a plain Error without `.status` so Koa falls back to 500.

class FakeOpenAiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'FakeOpenAiError';
        this.status = status;
    }
}

describe('rethrowWithoutStatus', () => {
    it('strips .status from a 429 error so Koa cannot inherit it', () => {
        const original = new FakeOpenAiError('rate limited', 429);

        try {
            rethrowWithoutStatus(original);
            assert.fail('rethrowWithoutStatus should have thrown');
        } catch (err) {
            assert.ok(err instanceof Error);
            assert.notStrictEqual(err, original, 'should rethrow as a new Error, not the original');
            assert.equal((err as { status?: unknown }).status, undefined, 'must not propagate .status');
            assert.equal(false, 'status' in err);
        }
    });

    it('preserves the original error message in the rethrown error', () => {
        const original = new FakeOpenAiError('upstream limit exceeded', 429);

        try {
            rethrowWithoutStatus(original);
            assert.fail('expected throw');
        } catch (err) {
            assert.ok(err instanceof Error);
            assert.ok(
                err.message.includes('upstream limit exceeded'),
                `expected original message in "${err.message}"`
            );
            assert.ok(err.message.includes('429'), 'status code should appear in the new message for debuggability');
        }
    });

    it('produces a plain Error (not the third-party subclass) so type checks downstream do not match', () => {
        const original = new FakeOpenAiError('boom', 503);

        try {
            rethrowWithoutStatus(original);
            assert.fail('expected throw');
        } catch (err) {
            assert.ok(err instanceof Error);
            assert.equal(err instanceof FakeOpenAiError, false);
        }
    });

    it('passes through an Error without .status — no status appears, message survives', () => {
        const original = new Error('no status here');

        try {
            rethrowWithoutStatus(original);
            assert.fail('expected throw');
        } catch (err) {
            assert.ok(err instanceof Error);
            assert.ok(!('status' in err), 'rethrown error must not carry a status');
            assert.equal(err.message, 'no status here');
        }
    });

    it('passes through non-Error throwables unchanged', () => {
        const thrown = { not: 'an error' };

        try {
            rethrowWithoutStatus(thrown);
            assert.fail('expected throw');
        } catch (err) {
            assert.strictEqual(err, thrown);
        }
    });

    it('handles 500-class status codes the same way (any numeric status is stripped)', () => {
        const original = new FakeOpenAiError('server side', 500);

        try {
            rethrowWithoutStatus(original);
            assert.fail('expected throw');
        } catch (err) {
            assert.ok(err instanceof Error);
            assert.equal((err as { status?: unknown }).status, undefined);
            assert.ok(err.message.includes('500'));
        }
    });
});
