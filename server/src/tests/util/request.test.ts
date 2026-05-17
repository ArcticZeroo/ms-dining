import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Response } from 'node-fetch';
import { makeRequestWithRetries } from '../../util/request.js';

// makeRequestWithRetries wraps runPromiseWithRetries with a hard-coded 1000ms
// delay between attempts. Keep retryCount low (0 or 1) so tests stay fast.

const okJson = (status: number = 200, body: string = '{}') =>
    new Response(body, { status, statusText: status === 200 ? 'OK' : String(status) });

describe('makeRequestWithRetries', () => {
    it('returns immediately on first success without retrying', async () => {
        let calls = 0;
        const response = await makeRequestWithRetries({
            makeRequest: async () => {
                calls++;
                return okJson(200);
            },
            retryCount: 2,
        });

        assert.equal(calls, 1);
        assert.equal(response.status, 200);
    });

    it('returns the response when no shouldRetry callback is provided', async () => {
        let calls = 0;
        const response = await makeRequestWithRetries({
            makeRequest: async () => {
                calls++;
                return okJson(500, 'server error');
            },
            retryCount: 0,
        });

        assert.equal(calls, 1);
        assert.equal(response.status, 500);
    });

    it('returns immediately when shouldRetry accepts the response (4xx pass-through)', async () => {
        let calls = 0;
        const response = await makeRequestWithRetries({
            makeRequest: async () => {
                calls++;
                return okJson(404, 'not found');
            },
            retryCount: 2,
            // shouldRetry true means "this response is acceptable, return it"
            shouldRetry: (resp) => resp.status < 500,
        });

        assert.equal(calls, 1, '4xx should not be retried when shouldRetry returns true');
        assert.equal(response.status, 404);
    });

    it('retries when shouldRetry rejects the response (5xx triggers retry)', async () => {
        const statuses: number[] = [];
        await assert.rejects(
            makeRequestWithRetries({
                makeRequest: async (i) => {
                    statuses.push(i);
                    return okJson(503, 'unavailable');
                },
                retryCount: 1, // 1 retry -> 2 attempts -> 1 delay (~1s)
                shouldRetry: (resp) => resp.status < 500,
            }),
            /503/
        );

        assert.equal(statuses.length, 2, 'should make retryCount+1 attempts before giving up');
        assert.deepEqual(statuses, [0, 1]);
    });

    it('retries when makeRequest itself throws and propagates the final error', async () => {
        const calls: number[] = [];
        await assert.rejects(
            makeRequestWithRetries({
                makeRequest: async (i) => {
                    calls.push(i);
                    throw new Error(`network failure on attempt ${i}`);
                },
                retryCount: 1, // 2 attempts total, ~1s delay
            }),
            /network failure on attempt 1/
        );

        assert.equal(calls.length, 2);
        assert.deepEqual(calls, [0, 1]);
    });

    it('only attempts once when retryCount is 0 and the request throws', async () => {
        let calls = 0;
        await assert.rejects(
            makeRequestWithRetries({
                makeRequest: async () => {
                    calls++;
                    throw new Error('boom');
                },
                retryCount: 0,
            }),
            /boom/
        );

        assert.equal(calls, 1, 'retryCount=0 should mean exactly one attempt');
    });

    it('returns the response that finally passes shouldRetry after a 5xx', async () => {
        const statuses = [503, 200];
        let i = 0;
        const response = await makeRequestWithRetries({
            makeRequest: async () => {
                const status = statuses[i++]!;
                return okJson(status, status === 200 ? 'ok' : 'try again');
            },
            retryCount: 1,
            shouldRetry: (resp) => resp.status < 500,
        });

        assert.equal(response.status, 200);
        assert.equal(i, 2);
    });
});
