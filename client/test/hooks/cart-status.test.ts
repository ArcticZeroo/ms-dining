import { describe, test, expect } from 'vitest';
import { computeCartStatus, type CartStatusInput } from '../../src/hooks/cart-status.ts';

const baseInput: CartStatusInput = {
    isPending:          false,
    isError:            false,
    error:              null,
    hasData:            false,
    totalItemCount:     0,
    hasUnavailableItems: false,
};

const make = (overrides: Partial<CartStatusInput> = {}) =>
    computeCartStatus({ ...baseInput, ...overrides });

describe('computeCartStatus', () => {
    test('empty cart, no errors', () => {
        const status = make();
        expect(status.isLoading).toBe(false);
        expect(status.isError).toBe(false);
        expect(status.hasWarning).toBe(false);
        expect(status.shouldShow).toBe(false);
    });

    test('loading state', () => {
        const status = make({ isPending: true });
        expect(status.isLoading).toBe(true);
        expect(status.shouldShow).toBe(true);
    });

    test('cart with items', () => {
        const status = make({ totalItemCount: 3, hasData: true });
        expect(status.totalItemCount).toBe(3);
        expect(status.shouldShow).toBe(true);
        expect(status.hasWarning).toBe(false);
    });

    test('error with no data shows error', () => {
        const error = new Error('network down');
        const status = make({ isError: true, error });
        expect(status.isError).toBe(true);
        expect(status.error).toBe(error);
        expect(status.hasWarning).toBe(true);
        expect(status.shouldShow).toBe(true);
    });

    test('error with existing data suppresses error', () => {
        const status = make({ isError: true, error: new Error('fail'), hasData: true, totalItemCount: 2 });
        expect(status.isError).toBe(false);
        expect(status.hasWarning).toBe(false);
        expect(status.shouldShow).toBe(true);
        expect(status.totalItemCount).toBe(2);
    });

    test('unavailable items show warning', () => {
        const status = make({ hasUnavailableItems: true, totalItemCount: 1, hasData: true });
        expect(status.hasWarning).toBe(true);
        expect(status.shouldShow).toBe(true);
    });

    test('unavailable items + error with data only warns about unavailable', () => {
        const status = make({ hasUnavailableItems: true, isError: true, hasData: true, totalItemCount: 1 });
        expect(status.isError).toBe(false);
        expect(status.hasWarning).toBe(true);
    });
});
