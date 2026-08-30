import { type IActivePaymentModal, shouldConfirmModalClose } from '../store/zustand/payment-coordination.ts';

export const LEAVE_WHILE_COMPLETING_MESSAGE = 'Your order is still being processed. If you leave now it may not be placed or may be placed more than once. Leave anyway?';

// Minimal shape of the router locations we inspect — structurally satisfied by
// react-router's Location, and easy to construct in tests.
interface INavigationSnapshot {
    pathname: string;
    hash: string;
}

interface IResolvePaymentCloseArgs {
    historyAction: string;
    currentLocation: INavigationSnapshot;
    nextLocation: INavigationSnapshot;
}

interface IPaymentCloseConfirmState {
    activeModal: IActivePaymentModal | null;
    completingCafeIds: ReadonlySet<string>;
}

/**
 * Decides whether an attempted navigation should be confirmed, and with what
 * message. Two independent guards, since only one blocker can be active:
 *  1. Dismissing the payment modal (a `#popup` pop) while the card is in flight.
 *  2. Leaving the checkout page (a pathname change) while an order is still being
 *     sent to the kitchen — otherwise the user misses the result and the guard
 *     against a strand/abort drops. Hash-only moves (opening another cafe's modal)
 *     stay on the same page and are allowed.
 * Returns the message to prompt with, or null to allow the navigation.
 */
export const resolvePaymentCloseConfirmMessage = (
    { historyAction, currentLocation, nextLocation }: IResolvePaymentCloseArgs,
    state: IPaymentCloseConfirmState,
): string | null => {
    // Modal is being closed
    if (shouldConfirmModalClose(state)
        && historyAction === 'POP'
        && currentLocation.hash === '#popup'
        && nextLocation.hash !== '#popup') {
        return LEAVE_WHILE_COMPLETING_MESSAGE;
    }

    // Order(s) being sent to the kitchen after modal payment
    if (state.completingCafeIds.size > 0 && currentLocation.pathname !== nextLocation.pathname) {
        return LEAVE_WHILE_COMPLETING_MESSAGE;
    }

    return null;
};
