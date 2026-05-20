import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ServiceError, SERVICE_ERROR_CODES } from './errors.js';
import { fromWire, isServiceErrorWire, parseServiceErrorWire, ServiceErrorWireSchema, toWire } from './errors-wire.js';

describe('toWire', () => {
    it('preserves code, message, details, and stack for a ServiceError', () => {
        const original = new ServiceError(
            SERVICE_ERROR_CODES.NOT_FOUND,
            'item missing',
            { id: 'abc' },
        );
        const wire = toWire(original);
        assert.equal(wire.kind, 'ServiceError');
        assert.equal(wire.code, 'NOT_FOUND');
        assert.equal(wire.message, 'item missing');
        assert.deepEqual(wire.details, { id: 'abc' });
        assert.equal(wire.stack, original.stack);
    });

    it('maps a plain Error to code INTERNAL and keeps its message and stack', () => {
        const original = new Error('something blew up');
        const wire = toWire(original);
        assert.equal(wire.code, 'INTERNAL');
        assert.equal(wire.message, 'something blew up');
        assert.equal(wire.stack, original.stack);
        assert.equal(wire.details, undefined);
    });

    it('maps a non-Error thrown value (string) to code INTERNAL with the stringified message', () => {
        const wire = toWire('bare string thrown');
        assert.equal(wire.code, 'INTERNAL');
        assert.equal(wire.message, 'bare string thrown');
        assert.equal(wire.stack, undefined);
    });

    it('maps an object literal to code INTERNAL via String() coercion', () => {
        const wire = toWire({ foo: 'bar' });
        assert.equal(wire.code, 'INTERNAL');
        // String({foo:'bar'}) is '[object Object]' — not pretty, but we'd
        // rather surface a literal than swallow the throw entirely.
        assert.equal(wire.message, '[object Object]');
    });
});

describe('fromWire', () => {
    it('round-trips a ServiceError: code, message, details, and stack preserved', () => {
        const original = new ServiceError(
            SERVICE_ERROR_CODES.CONFLICT,
            'duplicate id',
            { id: 'xyz' },
        );
        const restored = fromWire(toWire(original));
        assert.ok(restored instanceof ServiceError);
        assert.equal(restored.code, 'CONFLICT');
        assert.equal(restored.message, 'duplicate id');
        assert.deepEqual(restored.details, { id: 'xyz' });
        assert.equal(restored.stack, original.stack);
    });

    it('returns a real ServiceError that instanceof checks recognise', () => {
        const restored = fromWire({
            kind:    'ServiceError',
            code:    'NOT_FOUND',
            message: 'gone',
        });
        assert.ok(restored instanceof ServiceError);
        assert.ok(restored instanceof Error);
    });
});

describe('ServiceErrorWireSchema / parseServiceErrorWire', () => {
    it('downgrades an unknown code to INTERNAL so future codes do not crash older clients', () => {
        // Simulate a worker built with a newer set of codes than the main
        // client. Validation should succeed (the wire format is otherwise
        // well-formed) but the code gets replaced with INTERNAL.
        const restored = parseServiceErrorWire({
            kind:    'ServiceError',
            code:    'FUTURE_NEW_CODE',
            message: 'something new',
        });
        assert.ok(restored != null);
        assert.equal(restored.code, 'INTERNAL');
        assert.equal(restored.message, 'something new');
    });

    it('returns null for a malformed payload (missing required field)', () => {
        // Validation reports the failure rather than reconstructing a bogus
        // error — callers can fall back to a transport-level error message
        // instead of forwarding nonsense.
        const restored = parseServiceErrorWire({
            kind: 'ServiceError',
            code: 'NOT_FOUND',
            // missing `message`
        });
        assert.equal(restored, null);
    });

    it('returns null when kind is not "ServiceError"', () => {
        const restored = parseServiceErrorWire({
            kind:    'OtherError',
            code:    'NOT_FOUND',
            message: 'nope',
        });
        assert.equal(restored, null);
    });

    it('schema accepts an empty/absent details field', () => {
        const result = ServiceErrorWireSchema.safeParse({
            kind:    'ServiceError',
            code:    'NOT_FOUND',
            message: 'gone',
        });
        assert.equal(result.success, true);
    });
});

describe('isServiceErrorWire', () => {
    it('returns true for a well-formed wire payload', () => {
        assert.equal(isServiceErrorWire({
            kind:    'ServiceError',
            code:    'NOT_FOUND',
            message: 'gone',
        }), true);
    });

    it('returns false for null and undefined', () => {
        assert.equal(isServiceErrorWire(null), false);
        assert.equal(isServiceErrorWire(undefined), false);
    });

    it('returns false when kind is wrong', () => {
        assert.equal(isServiceErrorWire({
            kind:    'OtherError',
            code:    'NOT_FOUND',
            message: 'gone',
        }), false);
    });

    it('returns true when code is unknown (gets downgraded to INTERNAL by the schema)', () => {
        // Forward-compat behavior: a newer worker may emit codes the older
        // main hasn't seen. The schema accepts and the resulting wire object
        // carries code='INTERNAL'.
        assert.equal(isServiceErrorWire({
            kind:    'ServiceError',
            code:    'FUTURE_CODE',
            message: 'unknown',
        }), true);
    });

    it('returns false when message is missing', () => {
        assert.equal(isServiceErrorWire({
            kind: 'ServiceError',
            code: 'NOT_FOUND',
        }), false);
    });
});
