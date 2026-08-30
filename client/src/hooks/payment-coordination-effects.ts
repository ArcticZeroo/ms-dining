import { useCallback, useEffect, useRef } from 'react';
import { PopupContext } from '../context/modal.ts';
import { useValueNotifierContext } from './events.ts';
import { useLocationHash } from './location.ts';
import { useBeforeUnload } from './before-unload.ts';
import { type NavigationConfirmResolver, useNavigationConfirm } from './navigation-blocker.ts';
import { resolvePaymentCloseConfirmMessage } from '../util/payment-close-confirm.ts';
import {
    PAYMENT_POPUP_ID,
    usePaymentCoordinationStore,
    useShouldBlockUnloadForPayment,
} from '../store/zustand/payment-coordination.ts';

// Releases the payment lock when the modal transitions from open to closed.
//
// We observe the popup route (its id + the `#popup` hash), not the modal's
// unmount: the popup body legitimately unmounts/remounts without closing (React
// StrictMode's mount-time cleanup, and PopupContainer swapping the body between
// its mobile/desktop positions on resize). Those keep the route unchanged, so the
// lock is held until an actual close.
const usePaymentModalLockRelease = () => {
    const popup = useValueNotifierContext(PopupContext);
    const hash = useLocationHash();
    const activeCafeId = usePaymentCoordinationStore(state => state.activeModal?.cafeId ?? null);
    const endPaymentFlow = usePaymentCoordinationStore(state => state.endPaymentFlow);

    const isPaymentModalOpen = popup?.id === PAYMENT_POPUP_ID && hash === '#popup';
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (isPaymentModalOpen) {
            wasOpenRef.current = true;
            return;
        }

        if (wasOpenRef.current) {
            wasOpenRef.current = false;
            if (activeCafeId != null) {
                endPaymentFlow(activeCafeId);
            }
        }
    }, [isPaymentModalOpen, activeCafeId, endPaymentFlow]);
};

// Confirms before a navigation would either dismiss the payment modal mid-flight
// (Back / X / Escape / overlay, all POPs) or leave the checkout page while an
// order is still being sent to the kitchen. Reads the store live so the `closing`
// phase set right before a programmatic close is honored synchronously, letting
// our own success/cancel close through.
const usePaymentCloseConfirm = () => {
    const resolveMessage = useCallback<NavigationConfirmResolver>(
        (args) => resolvePaymentCloseConfirmMessage(args, usePaymentCoordinationStore.getState()),
        []
    );

    useNavigationConfirm(resolveMessage);
};

/**
 * Single, checkout-scoped owner of cross-cafe payment coordination side effects:
 *  - blocks tab close / refresh while any payment is submitted or an order is
 *    still being sent to the kitchen (from any cafe);
 *  - confirms before the user navigates the payment modal away mid-processing, or
 *    leaves the checkout page while an order is completing;
 *  - releases the "modal active" lock when the payment modal closes.
 *
 * Call once, from the checkout view.
 */
export const usePaymentCoordinationEffects = () => {
    useBeforeUnload(useShouldBlockUnloadForPayment());
    usePaymentCloseConfirm();
    usePaymentModalLockRelease();
};
