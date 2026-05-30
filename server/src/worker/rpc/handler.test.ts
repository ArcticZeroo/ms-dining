import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ServiceError } from './errors.js';
import { InProcessHandler, WorkerThreadHandler } from './handler.js';
import { ServiceMap } from './service-map.js';

const buildServices = () => {
    return {
        menu: {
            getItem: async (data: { id: string }) => ({ id: data.id, name: `Item ${data.id}` }),
            count:   async () => 42,
            failing: async () => {
                throw new ServiceError('NOT_FOUND', 'gone', { reason: 'expired' }); 
            },
            crashy:  async () => {
                throw new Error('boom'); 
            },
        },
    } satisfies ServiceMap;
};

describe('InProcessHandler', () => {
    it('dispatches to the registered method and returns the resolved value', async () => {
        const handler = new InProcessHandler(buildServices());
        const result = await handler.sendRequest('menu', 'getItem', { id: 'abc' });
        assert.deepEqual(result, { id: 'abc', name: 'Item abc' });
    });

    it('handles methods that ignore their data argument', async () => {
        const handler = new InProcessHandler(buildServices());
        const result = await handler.sendRequest('menu', 'count', undefined);
        assert.equal(result, 42);
    });

    it('allows omitting the data argument entirely for methods that take no parameter', async () => {
        // The method `count` is `async () => 42` — no data param. The
        // SendRequestTail conditional type makes the trailing arg optional
        // for those, so callers do not have to write `, undefined` at the
        // call site. (The previous test above passes `undefined` explicitly
        // and should still work; this one verifies the no-arg form.)
        const handler = new InProcessHandler(buildServices());
        const result = await handler.sendRequest('menu', 'count');
        assert.equal(result, 42);
    });

    it('rejects with the same ServiceError the service threw, including code and details', async () => {
        const handler = new InProcessHandler(buildServices());
        await assert.rejects(
            () => handler.sendRequest('menu', 'failing', undefined),
            (err: unknown) => {
                assert.ok(err instanceof ServiceError);
                assert.equal(err.code, 'NOT_FOUND');
                assert.equal(err.message, 'gone');
                assert.deepEqual(err.details, { reason: 'expired' });
                return true;
            },
        );
    });

    it('coerces a plain Error to a ServiceError(INTERNAL) so callers see consistent shapes (matches cross-thread)', async () => {
        const handler = new InProcessHandler(buildServices());
        await assert.rejects(
            () => handler.sendRequest('menu', 'crashy', undefined),
            (err: unknown) => {
                assert.ok(err instanceof ServiceError,
                    'plain Error should be coerced to ServiceError to match cross-thread behavior');
                assert.equal(err.code, 'INTERNAL');
                assert.equal(err.message, 'boom');
                return true;
            },
        );
    });

    it('clones arguments so the service cannot mutate caller-owned data', async () => {
        const sawData: unknown[] = [];
        const services = {
            menu: {
                inspect: async (data: { items: number[] }) => {
                    data.items.push(999);  // mutates the worker-side copy
                    sawData.push(data.items);
                    return data.items;
                },
            },
        } satisfies ServiceMap;

        const handler = new InProcessHandler(services);
        const callerOwned = { items: [1, 2, 3] };
        const result = await handler.sendRequest('menu', 'inspect', callerOwned);

        assert.deepEqual(callerOwned.items, [1, 2, 3],
            'caller-owned object must not be mutated by the service');
        assert.deepEqual(result, [1, 2, 3, 999]);
        assert.notEqual(sawData[0], callerOwned.items,
            'service should have received a clone, not the original reference');
    });

    it('clones return values so the caller cannot mutate worker-side cached state', async () => {
        const sharedState = { items: [1, 2, 3] };
        const services = {
            menu: {
                getShared: async () => sharedState,
            },
        } satisfies ServiceMap;

        const handler = new InProcessHandler(services);
        const result = await handler.sendRequest('menu', 'getShared', undefined);
        (result as { items: number[] }).items.push(999);

        assert.deepEqual(sharedState.items, [1, 2, 3],
            'worker-side state must not be mutable through the returned value');
    });

    it('cloneOverWire: false skips structuredClone (escape hatch for tests where the cost matters)', async () => {
        const services = {
            menu: {
                inspect: async (data: { items: number[] }) => {
                    data.items.push(999);
                    return data.items;
                },
            },
        } satisfies ServiceMap;

        const handler = new InProcessHandler(services, { cloneOverWire: false });
        const callerOwned = { items: [1, 2, 3] };
        await handler.sendRequest('menu', 'inspect', callerOwned);

        assert.deepEqual(callerOwned.items, [1, 2, 3, 999],
            'with cloneOverWire disabled, the service shares the caller object');
    });

    it('rejects with ServiceError(BAD_REQUEST) for an unknown service', async () => {
        const handler = new InProcessHandler(buildServices()) as unknown as {
            sendRequest: (s: string, m: string, d: unknown) => Promise<unknown>;
        };
        await assert.rejects(
            () => handler.sendRequest('nope', 'whatever', undefined),
            (err: unknown) => {
                assert.ok(err instanceof ServiceError);
                assert.equal(err.code, 'BAD_REQUEST');
                return true;
            },
        );
    });

    it('rejects with ServiceError(BAD_REQUEST) for an unknown method on a known service', async () => {
        const handler = new InProcessHandler(buildServices()) as unknown as {
            sendRequest: (s: string, m: string, d: unknown) => Promise<unknown>;
        };
        await assert.rejects(
            () => handler.sendRequest('menu', 'nope', undefined),
            (err: unknown) => {
                assert.ok(err instanceof ServiceError);
                assert.equal(err.code, 'BAD_REQUEST');
                return true;
            },
        );
    });
});

// ─── Cross-thread integration test ──────────────────────────────────────────
//
// The worker entry lives at handler.test-worker.ts. We resolve its compiled
// .js path relative to this test file's compiled location (dist/worker-rpc/)
// because Worker requires a runnable file URL, not a TS source path.

// Type the service shape so sendRequest below is properly inferred.
const TEST_WORKER_SERVICES = {
    echo: {
        roundTrip: async (data: { value: string; nested: { items: number[] } }) => {
            return { received: data };
        },
        sum: async (data: { numbers: number[] }) => {
            return data.numbers.reduce((acc, value) => acc + value, 0);
        },
    },
    fail: {
        withServiceError: async () => undefined as unknown,
        withPlainError:   async () => undefined as unknown,
    },
} satisfies ServiceMap;

const workerEntryPath = (): URL => {
    // import.meta.url here points at the compiled dist/worker/rpc/handler.test.js.
    // The worker entry compiles next to it as handler.test-worker.js.
    const thisDir = path.dirname(fileURLToPath(import.meta.url));
    return new URL(`file://${path.join(thisDir, 'handler.test-worker.js').replace(/\\/g, '/')}`);
};

describe('WorkerThreadHandler (cross-thread)', () => {
    const handler = new WorkerThreadHandler<typeof TEST_WORKER_SERVICES>(workerEntryPath());

    // Terminate the worker after the suite so the test runner can exit
    // without --test-force-exit needing to kill it.
    after(async () => {
        await handler.terminate();
    });

    it('round-trips a nested structured-clone-safe payload through a real worker', async () => {
        const payload = { value: 'hello', nested: { items: [1, 2, 3] } };
        const result = await handler.sendRequest('echo', 'roundTrip', payload);
        assert.deepEqual(result, { received: payload });
    });

    it('returns scalar values correctly', async () => {
        const result = await handler.sendRequest('echo', 'sum', { numbers: [10, 20, 30] });
        assert.equal(result, 60);
    });

    it('preserves ServiceError code, message, and details across the worker boundary', async () => {
        await assert.rejects(
            () => handler.sendRequest('fail', 'withServiceError', undefined),
            (err: unknown) => {
                assert.ok(err instanceof ServiceError);
                assert.equal(err.code, 'NOT_FOUND');
                assert.equal(err.message, 'gone');
                assert.deepEqual(err.details, { id: 'abc' });
                return true;
            },
        );
    });

    it('maps a plain Error thrown in the worker to ServiceError(INTERNAL) with its message preserved', async () => {
        await assert.rejects(
            () => handler.sendRequest('fail', 'withPlainError', undefined),
            (err: unknown) => {
                assert.ok(err instanceof ServiceError);
                assert.equal(err.code, 'INTERNAL');
                assert.equal(err.message, 'plain boom');
                return true;
            },
        );
    });

    it('supports concurrent requests; responses match the right request id', async () => {
        const [requestA, requestB, requestC] = await Promise.all([
            handler.sendRequest('echo', 'sum', { numbers: [1, 1, 1] }),
            handler.sendRequest('echo', 'sum', { numbers: [10, 10] }),
            handler.sendRequest('echo', 'sum', { numbers: [100] }),
        ]);
        assert.equal(requestA, 3);
        assert.equal(requestB, 20);
        assert.equal(requestC, 100);
    });

    it('works without providing the service map on the main thread', async () => {
        const result = await handler.sendRequest('echo', 'sum', { numbers: [4, 5] });
        assert.equal(result, 9);
    });
});
