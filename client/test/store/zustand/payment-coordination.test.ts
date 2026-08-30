import * as assert from 'node:assert';
import { afterEach, beforeEach, describe, it, vi } from 'vitest';
import {
    PAYMENT_STALL_TIMEOUT_MS,
    isOtherPaymentActive,
    shouldBlockUnloadForPayment,
    shouldConfirmModalClose,
    usePaymentCoordinationStore,
} from '../../../src/store/zustand/payment-coordination.ts';

const resetStore = () => {
    usePaymentCoordinationStore.setState({
        activeModal:       null,
        completingCafeIds: new Set(),
    });
};

const getState = () => usePaymentCoordinationStore.getState();
const modalStatus = () => getState().activeModal?.state.status;
const isStalled = () => {
    const state = getState().activeModal?.state;
    return state?.status === 'submitting' ? state.isStalled : undefined;
};

describe('payment coordination store', () => {
    beforeEach(() => {
        // markSubmitting arms a real setTimeout; fake timers keep tests fast and
        // isolated, and let us assert the stall transition deterministically.
        vi.useFakeTimers();
        resetStore();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ─── Payment flow lock ───────────────────────────────────────────

    it('startPaymentFlow takes the lock for a cafe, entering details', () => {
        getState().startPaymentFlow('cafe-a');
        assert.equal(getState().activeModal?.cafeId, 'cafe-a');
        assert.equal(modalStatus(), 'entering-details');
    });

    it('startPaymentFlow allows same-cafe re-entry, resetting the phase', () => {
        getState().startPaymentFlow('cafe-a');
        getState().markSubmitting();
        getState().startPaymentFlow('cafe-a');
        assert.equal(getState().activeModal?.cafeId, 'cafe-a');
        assert.equal(modalStatus(), 'entering-details');
    });

    it('startPaymentFlow throws if another cafe still owns the modal', () => {
        getState().startPaymentFlow('cafe-a');
        assert.throws(() => getState().startPaymentFlow('cafe-b'), /still owns the modal/);
        // The existing lock is left untouched.
        assert.equal(getState().activeModal?.cafeId, 'cafe-a');
    });

    it('endPaymentFlow releases the lock', () => {
        getState().startPaymentFlow('cafe-a');
        getState().markSubmitting();
        getState().endPaymentFlow('cafe-a');
        assert.equal(getState().activeModal, null);
    });

    it('endPaymentFlow is a no-op when another cafe owns the lock', () => {
        getState().startPaymentFlow('cafe-b');
        // A stale release from cafe-a (e.g. its modal unmounting late) must not
        // steal the lock cafe-b just acquired.
        getState().endPaymentFlow('cafe-a');
        assert.equal(getState().activeModal?.cafeId, 'cafe-b');
    });

    // ─── Modal phase transitions ─────────────────────────────────────

    it('markSubmitting enters submitting with no stall', () => {
        getState().startPaymentFlow('cafe-a');
        getState().markSubmitting();
        assert.equal(modalStatus(), 'submitting');
        assert.equal(isStalled(), false);
    });

    it('markClosing suppresses the close confirm for our own close', () => {
        getState().startPaymentFlow('cafe-a');
        getState().markSubmitting();
        getState().markClosing();
        assert.equal(modalStatus(), 'closing');
        assert.equal(shouldConfirmModalClose(getState()), false);
    });

    it('the phase actions throw when no modal is active', () => {
        assert.throws(() => getState().markEnteringDetails(), /requires an active payment modal/);
        assert.throws(() => getState().markSubmitting(), /requires an active payment modal/);
        assert.throws(() => getState().markClosing(), /requires an active payment modal/);
    });

    // ─── Store-owned stall timer ─────────────────────────────────────

    it('flags stalled after the timeout while submitting', () => {
        getState().startPaymentFlow('cafe-a');
        getState().markSubmitting();
        vi.advanceTimersByTime(PAYMENT_STALL_TIMEOUT_MS);
        assert.equal(isStalled(), true);
    });

    it('does not flag stalled once the phase leaves submitting', () => {
        getState().startPaymentFlow('cafe-a');
        getState().markSubmitting();
        getState().markEnteringDetails();
        vi.advanceTimersByTime(PAYMENT_STALL_TIMEOUT_MS);
        assert.equal(modalStatus(), 'entering-details');
    });

    it('re-arms the stall timer on resubmit', () => {
        getState().startPaymentFlow('cafe-a');
        getState().markSubmitting();
        vi.advanceTimersByTime(PAYMENT_STALL_TIMEOUT_MS - 1);

        getState().markSubmitting(); // resubmit resets the clock
        vi.advanceTimersByTime(PAYMENT_STALL_TIMEOUT_MS - 1);
        assert.equal(isStalled(), false);

        vi.advanceTimersByTime(1);
        assert.equal(isStalled(), true);
    });

    it('clears the stall timer when the flow ends', () => {
        getState().startPaymentFlow('cafe-a');
        getState().markSubmitting();
        getState().endPaymentFlow('cafe-a');
        // The fired timer must not resurrect anything after release.
        vi.advanceTimersByTime(PAYMENT_STALL_TIMEOUT_MS);
        assert.equal(getState().activeModal, null);
    });

    // ─── Completing set ──────────────────────────────────────────────

    it('startCompleting and endCompleting manage the set independently', () => {
        getState().startCompleting('cafe-a');
        getState().startCompleting('cafe-b');
        assert.ok(getState().completingCafeIds.has('cafe-a'));
        assert.ok(getState().completingCafeIds.has('cafe-b'));

        getState().endCompleting('cafe-a');
        assert.equal(getState().completingCafeIds.has('cafe-a'), false);
        assert.ok(getState().completingCafeIds.has('cafe-b'));
    });

    it('completing is independent of the modal lock', () => {
        getState().startPaymentFlow('cafe-a');
        getState().startCompleting('cafe-a');
        getState().endPaymentFlow('cafe-a');
        // Modal closed, but the order is still being sent to the kitchen.
        assert.equal(getState().activeModal, null);
        assert.ok(getState().completingCafeIds.has('cafe-a'));
    });

    // ─── isOtherPaymentActive predicate ──────────────────────────────

    it('isOtherPaymentActive is false when nothing is active', () => {
        assert.equal(isOtherPaymentActive(null, 'cafe-a'), false);
    });

    it('isOtherPaymentActive is false for the cafe that owns the lock', () => {
        assert.equal(isOtherPaymentActive({ cafeId: 'cafe-a', state: { status: 'entering-details' } }, 'cafe-a'), false);
    });

    it('isOtherPaymentActive is true for a different cafe', () => {
        assert.equal(isOtherPaymentActive({ cafeId: 'cafe-a', state: { status: 'entering-details' } }, 'cafe-b'), true);
    });

    // ─── shouldConfirmModalClose predicate ───────────────────────────

    it('shouldConfirmModalClose is false with no active modal', () => {
        assert.equal(shouldConfirmModalClose({ activeModal: null }), false);
    });

    it('shouldConfirmModalClose is false while only entering details', () => {
        assert.equal(shouldConfirmModalClose({ activeModal: { cafeId: 'cafe-a', state: { status: 'entering-details' } } }), false);
    });

    it('shouldConfirmModalClose is true while submitting', () => {
        assert.equal(
            shouldConfirmModalClose({ activeModal: { cafeId: 'cafe-a', state: { status: 'submitting', isStalled: false } } }),
            true,
        );
    });

    it('shouldConfirmModalClose is false while closing (our own close)', () => {
        assert.equal(shouldConfirmModalClose({ activeModal: { cafeId: 'cafe-a', state: { status: 'closing' } } }), false);
    });

    // ─── shouldBlockUnloadForPayment predicate ───────────────────────

    it('shouldBlockUnloadForPayment is false when idle', () => {
        assert.equal(shouldBlockUnloadForPayment({ activeModal: null, completingCafeIds: new Set() }), false);
    });

    it('shouldBlockUnloadForPayment is false while only entering details', () => {
        assert.equal(
            shouldBlockUnloadForPayment({ activeModal: { cafeId: 'cafe-a', state: { status: 'entering-details' } }, completingCafeIds: new Set() }),
            false,
        );
    });

    it('shouldBlockUnloadForPayment is true while the modal is submitting', () => {
        assert.equal(
            shouldBlockUnloadForPayment({ activeModal: { cafeId: 'cafe-a', state: { status: 'submitting', isStalled: false } }, completingCafeIds: new Set() }),
            true,
        );
    });

    it('shouldBlockUnloadForPayment is true while any order is completing', () => {
        assert.equal(
            shouldBlockUnloadForPayment({ activeModal: null, completingCafeIds: new Set(['cafe-a']) }),
            true,
        );
    });

    it('shouldBlockUnloadForPayment tracks the live store through a full cycle', () => {
        assert.equal(shouldBlockUnloadForPayment(getState()), false);

        getState().startPaymentFlow('cafe-a');
        getState().markSubmitting();
        assert.equal(shouldBlockUnloadForPayment(getState()), true);

        // Success: modal closes, order starts being sent to the kitchen.
        getState().startCompleting('cafe-a');
        getState().endPaymentFlow('cafe-a');
        assert.equal(shouldBlockUnloadForPayment(getState()), true);

        // Kitchen send finishes.
        getState().endCompleting('cafe-a');
        assert.equal(shouldBlockUnloadForPayment(getState()), false);
    });
});
