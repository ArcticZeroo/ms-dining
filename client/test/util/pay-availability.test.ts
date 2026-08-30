import * as assert from 'node:assert';
import { describe, it } from 'vitest';
import { derivePayAvailability } from '../../src/util/pay-availability.ts';

const allClear = {
    isReadyToPay:         true,
    isIdentityValid:      true,
    hasUnavailableItems:  false,
    isOtherPaymentActive: false,
};

describe('derivePayAvailability', () => {
    it('can pay when ready and every gate passes', () => {
        assert.deepEqual(derivePayAvailability(allClear), { canPay: true, blockReason: null });
    });

    it('is not payable when not ready, even if every gate passes', () => {
        assert.deepEqual(
            derivePayAvailability({ ...allClear, isReadyToPay: false }),
            { canPay: false, blockReason: null },
        );
    });

    it('blocks on unavailable items above all other reasons', () => {
        const result = derivePayAvailability({
            ...allClear,
            hasUnavailableItems:  true,
            isIdentityValid:      false,
            isOtherPaymentActive: true,
        });
        assert.deepEqual(result, { canPay: false, blockReason: 'unavailable-items' });
    });

    it('blocks on invalid identity above other-payment', () => {
        assert.deepEqual(
            derivePayAvailability({ ...allClear, isIdentityValid: false, isOtherPaymentActive: true }),
            { canPay: false, blockReason: 'invalid-identity' },
        );
    });

    it('blocks when another cafe is paying', () => {
        assert.deepEqual(
            derivePayAvailability({ ...allClear, isOtherPaymentActive: true }),
            { canPay: false, blockReason: 'other-payment-active' },
        );
    });
});
