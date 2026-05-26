import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceError, ServiceErrorCode, SERVICE_ERROR_CODES } from './errors.js';

describe('SERVICE_ERROR_CODES', () => {
    it('value object keys match the literal type members', () => {
        // Compile-time check: every value in the const map must round-trip
        // through the type. Runtime check: there are no surprise extras.
        const expectedKeys: ServiceErrorCode[] = [
            'NOT_FOUND',
            'BAD_REQUEST',
            'UNAUTHORIZED',
            'FORBIDDEN',
            'CONFLICT',
            'RATE_LIMITED',
            'UPSTREAM_FAIL',
            'INTERNAL',
        ];
        const actualKeys = Object.keys(SERVICE_ERROR_CODES).sort();
        assert.deepEqual(actualKeys, expectedKeys.slice().sort());
    });

    it('value at each key equals the key itself', () => {
        for (const key of Object.keys(SERVICE_ERROR_CODES) as ServiceErrorCode[]) {
            assert.equal(SERVICE_ERROR_CODES[key], key);
        }
    });
});

describe('ServiceError', () => {
    it('captures code, message, and optional details', () => {
        const err = new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'item missing', { id: 'abc' });
        assert.equal(err.code, 'NOT_FOUND');
        assert.equal(err.message, 'item missing');
        assert.deepEqual(err.details, { id: 'abc' });
    });

    it('is an instance of Error so existing catch chains still see it', () => {
        const err = new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'boom');
        assert.ok(err instanceof Error);
        assert.ok(err instanceof ServiceError);
    });

    it('uses a stable name (ServiceError) so logs and assertions can match on it', () => {
        const err = new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'bad');
        assert.equal(err.name, 'ServiceError');
    });

    it('details defaults to undefined when not provided', () => {
        const err = new ServiceError(SERVICE_ERROR_CODES.FORBIDDEN, 'nope');
        assert.equal(err.details, undefined);
    });
});
