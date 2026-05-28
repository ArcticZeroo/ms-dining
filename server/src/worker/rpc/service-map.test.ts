import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceError } from './errors.js';
import { dispatch, ServiceMap } from './service-map.js';

describe('dispatch', () => {
    const services = {
        menu: {
            getItem: async (data: { id: string }) => ({ id: data.id, name: `Item ${data.id}` }),
            count:   async () => 42,
        },
        cafe: {
            ping: async () => 'pong',
        },
    } satisfies ServiceMap;

    it('routes to the correct method by serviceName and methodName', async () => {
        const result = await dispatch(services, 'menu', 'getItem', { id: 'abc' });
        assert.deepEqual(result, { id: 'abc', name: 'Item abc' });
    });

    it('handles methods that ignore their data argument', async () => {
        const result = await dispatch(services, 'menu', 'count', undefined);
        assert.equal(result, 42);
    });

    it('reaches a different service via the outer namespace', async () => {
        const result = await dispatch(services, 'cafe', 'ping', undefined);
        assert.equal(result, 'pong');
    });

    it('throws a ServiceError(BAD_REQUEST) for an unknown service', async () => {
        await assert.rejects(
            () => dispatch(services, 'nope', 'whatever', undefined),
            (err: unknown) => {
                assert.ok(err instanceof ServiceError);
                assert.equal(err.code, 'BAD_REQUEST');
                assert.match(err.message, /Unknown service: "nope"/);
                return true;
            },
        );
    });

    it('throws a ServiceError(BAD_REQUEST) for an unknown method on a known service', async () => {
        await assert.rejects(
            () => dispatch(services, 'menu', 'nope', undefined),
            (err: unknown) => {
                assert.ok(err instanceof ServiceError);
                assert.equal(err.code, 'BAD_REQUEST');
                assert.match(err.message, /Unknown method: "menu\.nope"/);
                return true;
            },
        );
    });

    it('propagates a ServiceError thrown from inside the method', async () => {
        const withThrowingService = {
            menu: {
                getItem: async () => {
                    throw new ServiceError('NOT_FOUND', 'gone'); 
                },
            },
        } satisfies ServiceMap;
        await assert.rejects(
            () => dispatch(withThrowingService, 'menu', 'getItem', undefined),
            (err: unknown) => {
                assert.ok(err instanceof ServiceError);
                assert.equal(err.code, 'NOT_FOUND');
                assert.equal(err.message, 'gone');
                return true;
            },
        );
    });

    it('propagates a plain Error thrown from inside the method (caller can decide what to do with it)', async () => {
        const withThrowingService = {
            menu: {
                getItem: async () => {
                    throw new Error('uncaught boom'); 
                },
            },
        } satisfies ServiceMap;
        await assert.rejects(
            () => dispatch(withThrowingService, 'menu', 'getItem', undefined),
            (err: unknown) => {
                assert.ok(err instanceof Error);
                assert.equal((err as Error).message, 'uncaught boom');
                return true;
            },
        );
    });
});
