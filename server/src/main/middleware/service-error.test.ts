import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Context } from 'koa';
import { ServiceError, SERVICE_ERROR_CODES } from '../../shared/rpc/errors.js';
import { serviceErrorMiddleware } from './service-error.js';

interface MockContext {
    method: string;
    path: string;
    status?: number;
    type?: string;
    body?: unknown;
}

/**
 * Minimal subset of koa Context our middleware touches. Cast to Context so
 * the middleware accepts it; runtime never inspects fields we don't set here.
 */
const buildMockContext = (overrides: Partial<MockContext> = {}): Context => {
    const ctx: MockContext = {
        method: 'GET',
        path:   '/test',
        ...overrides,
    };
    return ctx as unknown as Context;
};

describe('serviceErrorMiddleware', () => {
    it('translates ServiceError(NOT_FOUND) to status 404 + JSON body { code, message }', async () => {
        const ctx = buildMockContext();
        await serviceErrorMiddleware(ctx, async () => {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'item missing');
        });

        assert.equal(ctx.status, 404);
        assert.equal(ctx.type, 'application/json');
        assert.deepEqual(ctx.body, {
            code:    'NOT_FOUND',
            message: 'item missing',
        });
    });

    it('translates ServiceError(BAD_REQUEST) to status 400', async () => {
        const ctx = buildMockContext();
        await serviceErrorMiddleware(ctx, async () => {
            throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'bad input');
        });
        assert.equal(ctx.status, 400);
        assert.deepEqual(ctx.body, { code: 'BAD_REQUEST', message: 'bad input' });
    });

    it('translates ServiceError(UNAUTHORIZED) to status 401', async () => {
        const ctx = buildMockContext();
        await serviceErrorMiddleware(ctx, async () => {
            throw new ServiceError(SERVICE_ERROR_CODES.UNAUTHORIZED, 'need login');
        });
        assert.equal(ctx.status, 401);
    });

    it('translates ServiceError(FORBIDDEN) to status 403', async () => {
        const ctx = buildMockContext();
        await serviceErrorMiddleware(ctx, async () => {
            throw new ServiceError(SERVICE_ERROR_CODES.FORBIDDEN, 'no');
        });
        assert.equal(ctx.status, 403);
    });

    it('translates ServiceError(CONFLICT) to status 409', async () => {
        const ctx = buildMockContext();
        await serviceErrorMiddleware(ctx, async () => {
            throw new ServiceError(SERVICE_ERROR_CODES.CONFLICT, 'dup');
        });
        assert.equal(ctx.status, 409);
    });

    it('translates ServiceError(RATE_LIMITED) to status 429', async () => {
        const ctx = buildMockContext();
        await serviceErrorMiddleware(ctx, async () => {
            throw new ServiceError(SERVICE_ERROR_CODES.RATE_LIMITED, 'slow down');
        });
        assert.equal(ctx.status, 429);
    });

    it('translates ServiceError(UPSTREAM_FAIL) to status 502', async () => {
        const ctx = buildMockContext();
        await serviceErrorMiddleware(ctx, async () => {
            throw new ServiceError(SERVICE_ERROR_CODES.UPSTREAM_FAIL, 'upstream down');
        });
        assert.equal(ctx.status, 502);
    });

    it('translates ServiceError(INTERNAL) to status 500', async () => {
        const ctx = buildMockContext();
        await serviceErrorMiddleware(ctx, async () => {
            throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'something broke');
        });
        assert.equal(ctx.status, 500);
    });

    it('includes a details field in the response body when ServiceError carries details', async () => {
        const ctx = buildMockContext();
        await serviceErrorMiddleware(ctx, async () => {
            throw new ServiceError(
                SERVICE_ERROR_CODES.NOT_FOUND,
                'missing',
                { id: 'abc', kind: 'menuItem' },
            );
        });
        assert.deepEqual(ctx.body, {
            code:    'NOT_FOUND',
            message: 'missing',
            details: { id: 'abc', kind: 'menuItem' },
        });
    });

    it('omits the details field entirely when ServiceError has no details', async () => {
        const ctx = buildMockContext();
        await serviceErrorMiddleware(ctx, async () => {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'missing');
        });
        const body = ctx.body as Record<string, unknown>;
        assert.equal('details' in body, false,
            'details key must be absent (not undefined) so JSON serialization matches expectations');
    });

    it('passes through non-ServiceError exceptions for downstream handlers (e.g. BoD translator)', async () => {
        const ctx = buildMockContext();
        const plainError = new Error('not ours');

        await assert.rejects(
            () => serviceErrorMiddleware(ctx, async () => {
                throw plainError; 
            }),
            (err: unknown) => {
                assert.equal(err, plainError, 'middleware must rethrow the exact error instance');
                return true;
            },
        );
        // ctx must not be mutated when the error wasn't ours
        assert.equal(ctx.status, undefined);
        assert.equal(ctx.body, undefined);
    });

    it('does nothing when the next middleware does not throw', async () => {
        const ctx = buildMockContext();
        let nextCalled = false;
        await serviceErrorMiddleware(ctx, async () => {
            nextCalled = true;
        });
        assert.equal(nextCalled, true);
        assert.equal(ctx.status, undefined);
        assert.equal(ctx.body, undefined);
    });
});
