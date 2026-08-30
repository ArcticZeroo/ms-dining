import * as assert from 'node:assert';
import { describe, it } from 'vitest';
import {
    LEAVE_WHILE_COMPLETING_MESSAGE,
    resolvePaymentCloseConfirmMessage,
} from '../../src/util/payment-close-confirm.ts';

const idleState = {
    activeModal:       null,
    completingCafeIds: new Set<string>(),
};

const submittingState = {
    activeModal:       { cafeId: 'cafe-a', state: { status: 'submitting' as const, isStalled: false } },
    completingCafeIds: new Set<string>(),
};

const closingState = {
    activeModal:       { cafeId: 'cafe-a', state: { status: 'closing' as const } },
    completingCafeIds: new Set<string>(),
};

const popupToOrder = {
    historyAction:   'POP',
    currentLocation: { pathname: '/order', hash: '#popup' },
    nextLocation:    { pathname: '/order', hash: '' },
};

const orderToHistory = {
    historyAction:   'PUSH',
    currentLocation: { pathname: '/order', hash: '' },
    nextLocation:    { pathname: '/order/history', hash: '' },
};

describe('resolvePaymentCloseConfirmMessage', () => {
    it('allows navigation when nothing is in flight', () => {
        assert.strictEqual(resolvePaymentCloseConfirmMessage(popupToOrder, idleState), null);
    });

    // ─── Modal-close arm ─────────────────────────────────────────────

    it('confirms dismissing the modal while processing', () => {
        const message = resolvePaymentCloseConfirmMessage(popupToOrder, submittingState);
        assert.strictEqual(message, LEAVE_WHILE_COMPLETING_MESSAGE);
    });

    it('does not confirm our own finalizing close', () => {
        const message = resolvePaymentCloseConfirmMessage(popupToOrder, closingState);
        assert.strictEqual(message, null);
    });

    it('does not confirm a non-POP modal navigation', () => {
        const message = resolvePaymentCloseConfirmMessage(
            { ...popupToOrder, historyAction: 'PUSH' },
            submittingState,
        );
        assert.strictEqual(message, null);
    });

    // ─── Completing arm ──────────────────────────────────────────────

    it('confirms leaving the checkout page while an order is completing', () => {
        const message = resolvePaymentCloseConfirmMessage(orderToHistory, {
            ...idleState,
            completingCafeIds: new Set(['cafe-a']),
        });
        assert.strictEqual(message, LEAVE_WHILE_COMPLETING_MESSAGE);
    });

    it('allows a hash-only move (opening another modal) while completing', () => {
        const message = resolvePaymentCloseConfirmMessage(
            { historyAction: 'PUSH', currentLocation: { pathname: '/order', hash: '' }, nextLocation: { pathname: '/order', hash: '#popup' } },
            { ...idleState, completingCafeIds: new Set(['cafe-a']) },
        );
        assert.strictEqual(message, null);
    });

    it('does not confirm leaving when nothing is completing', () => {
        assert.strictEqual(resolvePaymentCloseConfirmMessage(orderToHistory, idleState), null);
    });
});
