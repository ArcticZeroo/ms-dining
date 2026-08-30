import { create } from 'zustand';
import { mutative } from 'zustand-mutative';

// Identifies the payment popup within the shared popup system. Lives here (rather
// than in cafe-payment-flow) so the coordination observer can recognize the
// payment modal without importing the whole payment-flow module.
export const PAYMENT_POPUP_ID = Symbol('order-cafe-payment');

// The iframe fires one gateway round-trip between submit and a terminal message,
// so a stall isn't instant. If nothing terminal arrives within this window we
// surface an advisory (non-blocking) notice — a real message can still supersede
// it, so we never wrongly abort a slow-but-legitimate flow.
export const PAYMENT_STALL_TIMEOUT_MS = 20_000;

// A single cafe order moves through two cooperating state machines:
//
//   1. The per-cafe async lifecycle (`PaymentState` in cafe-payment-flow), derived
//      from React Query: ready-to-pay → preparing → [modal] → completing → completed.
//      React Query owns those transitions; we do not duplicate them here.
//
//   2. The modal lifecycle below — the singular, iframe-driven phase of the one
//      open payment modal. It's owned by this store (not the cafe hook) because the
//      modal is mounted outside the cafe's tree and its phase is read by both the
//      overlay (popup-mounted) and the leave-guards (singleton in checkout):
//
//        entering-details ──submit──▶ submitting ──success/cancel──▶ closing
//               ▲    ▲                    │
//               │    └──stall timeout─────┘ (stays submitting, isStalled = true)
//               └──idle / validation──────┘
//
// `isStalled` only exists on `submitting`, so a stall is unrepresentable in any
// other phase. The store owns the stall timeout: `markSubmitting()` arms it and
// every transition out of `submitting` clears it, so the modal body never manages
// a timer. `closing` is set right before we programmatically close (payment
// succeeded / iframe cancelled) so the nav guard lets that close through.
export type PaymentModalState =
    | { status: 'entering-details' }
    | { status: 'submitting'; isStalled: boolean }
    | { status: 'closing' };

export interface IActivePaymentModal {
    cafeId: string;
    state: PaymentModalState;
}

interface IPaymentCoordinationStore {
    // The cafe whose payment modal is open, plus that modal's phase. Only one modal
    // can be open at a time, so while this is set every OTHER cafe's Pay button is
    // disabled. Cleared as soon as the modal closes, even if that cafe's order is
    // still being sent to the kitchen.
    activeModal: IActivePaymentModal | null;
    // Cafes whose orders are being sent to the kitchen after a successful payment.
    // These block navigating away but do NOT gate other cafes' Pay buttons, so a
    // second cafe can be `activeModal` while a first is still completing.
    completingCafeIds: Set<string>;

    startPaymentFlow(cafeId: string): void;
    endPaymentFlow(cafeId: string): void;
    markEnteringDetails(): void;
    markSubmitting(): void;
    markStalled(): void;
    markClosing(): void;
    startCompleting(cafeId: string): void;
    endCompleting(cafeId: string): void;
}

// The stall timeout is a side effect, so it lives beside the store rather than in
// state: `markSubmitting` arms it and any transition out of `submitting` clears it.
let stallTimerId: ReturnType<typeof setTimeout> | undefined;

const clearStallTimer = () => {
    if (stallTimerId !== undefined) {
        clearTimeout(stallTimerId);
        stallTimerId = undefined;
    }
};

// The modal-phase actions are only ever called from the payment modal body, which
// exists only while a modal is active. A missing modal is therefore a caller bug,
// not a valid state — surface it loudly in dev, no-op in prod.
const requireActiveModal = (activeModal: IActivePaymentModal | null, action: string): boolean => {
    if (activeModal != null) {
        return true;
    }

    if (import.meta.env.DEV) {
        throw new Error(`payment-coordination: ${action}() requires an active payment modal`);
    }

    return false;
};

export const usePaymentCoordinationStore = create<IPaymentCoordinationStore>()(mutative((set, get) => ({
    activeModal:       null,
    completingCafeIds: new Set(),

    startPaymentFlow: (cafeId) => {
        // Only one modal at a time; another cafe taking over is a caller bug (the
        // Pay-button gating should prevent reaching here). Same-cafe re-entry is
        // fine — it resets the modal after e.g. a prepare-failure retry.
        const { activeModal } = get();
        if (import.meta.env.DEV && activeModal != null && activeModal.cafeId !== cafeId) {
            throw new Error(`payment-coordination: startPaymentFlow('${cafeId}') while '${activeModal.cafeId}' still owns the modal`);
        }

        clearStallTimer();
        set((state) => {
            state.activeModal = { cafeId, state: { status: 'entering-details' } };
        });
    },

    endPaymentFlow: (cafeId) => {
        // Idempotent, owner-checked release: only clear the lock if we still own it.
        if (get().activeModal?.cafeId !== cafeId) {
            return;
        }

        clearStallTimer();
        set((state) => {
            state.activeModal = null;
        });
    },

    markEnteringDetails: () => {
        if (!requireActiveModal(get().activeModal, 'markEnteringDetails')) {
            return;
        }

        clearStallTimer();
        set((state) => {
            if (state.activeModal) {
                state.activeModal.state = { status: 'entering-details' };
            }
        });
    },

    markSubmitting: () => {
        if (!requireActiveModal(get().activeModal, 'markSubmitting')) {
            return;
        }

        clearStallTimer();
        set((state) => {
            if (state.activeModal) {
                state.activeModal.state = { status: 'submitting', isStalled: false };
            }
        });
        // A resubmit (e.g. a replayed DataDome challenge) re-arms from scratch.
        stallTimerId = setTimeout(() => get().markStalled(), PAYMENT_STALL_TIMEOUT_MS);
    },

    markStalled: () => {
        // Fired by the timer, so no active-modal assertion — a terminal/idle message
        // that landed between arming and firing already moved us on (this no-ops).
        stallTimerId = undefined;
        set((state) => {
            if (state.activeModal?.state.status === 'submitting') {
                state.activeModal.state.isStalled = true;
            }
        });
    },

    markClosing: () => {
        if (!requireActiveModal(get().activeModal, 'markClosing')) {
            return;
        }

        clearStallTimer();
        set((state) => {
            if (state.activeModal) {
                state.activeModal.state = { status: 'closing' };
            }
        });
    },

    startCompleting: (cafeId) => set((state) => {
        state.completingCafeIds.add(cafeId);
    }),

    endCompleting: (cafeId) => set((state) => {
        state.completingCafeIds.delete(cafeId);
    }),
})));

// Pure predicates, extracted so they can be unit-tested without rendering a hook.

/** Whether another cafe holds the payment lock, so `cafeId` can't start paying. */
export const isOtherPaymentActive = (activeModal: IActivePaymentModal | null, cafeId: string) =>
    activeModal != null && activeModal.cafeId !== cafeId;

/** Whether any payment is submitted or any order is still being sent to the kitchen. */
export const shouldBlockUnloadForPayment = (
    state: Pick<IPaymentCoordinationStore, 'activeModal' | 'completingCafeIds'>,
) => state.activeModal?.state.status === 'submitting' || state.completingCafeIds.size > 0;

/** Whether a modal close should be confirmed — submitted, and not our own close. */
export const shouldConfirmModalClose = (
    state: Pick<IPaymentCoordinationStore, 'activeModal'>,
) => state.activeModal?.state.status === 'submitting';

/** True when another cafe holds the payment lock, so this cafe can't start paying. */
export const useIsOtherPaymentActive = (cafeId: string) =>
    usePaymentCoordinationStore((state) => isOtherPaymentActive(state.activeModal, cafeId));

/** True while any payment is submitted or any order is still being sent to the kitchen. */
export const useShouldBlockUnloadForPayment = () =>
    usePaymentCoordinationStore(shouldBlockUnloadForPayment);
