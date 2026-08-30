import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ICompleteOrderResult, IOrderItem } from '@msdining/common/models/order';
import type { ICartItemRecord } from '@msdining/common/models/cart';
import type { Nullable } from '@msdining/common/models/util';
import { usePopupCloserAlways, usePopupOpener } from './popup.ts';
import { useCompleteOrderMutation, usePreparePaymentMutation } from '../store/queries/ordering.ts';
import { usePaymentIdentityContext } from '../context/payment-identity.ts';
import { PAYMENT_POPUP_ID, useIsOtherPaymentActive, usePaymentCoordinationStore } from '../store/zustand/payment-coordination.ts';
import { type IPayAvailability, derivePayAvailability } from '../util/pay-availability.ts';
import { getErrorMessage } from '../util/mutation.ts';
import { PaymentPopup } from '../components/pages/order/payment/payment-popup.tsx';

const toOrderItem = (item: ICartItemRecord): IOrderItem => ({
    menuItemId:          item.menuItemId,
    quantity:            item.quantity,
    modifiers:           item.modifiers,
    specialInstructions: item.specialInstructions ?? undefined,
});

interface IUseCafePaymentFlowParams {
    cafeId: string;
    items: ICartItemRecord[];
}

export type PaymentState =
    | { status: 'ready-to-pay'; notice?: string }
    | { status: 'preparing' }
    | { status: 'completing' }
    | { status: 'completed'; result: ICompleteOrderResult };

export interface ICafePaymentFlowResult {
    handlePay: () => void;
    paymentState: PaymentState;
    payAvailability: IPayAvailability;
    hasUnavailableItems: boolean;
}

interface IDerivePaymentStateParams {
    completionResult: ICompleteOrderResult | undefined;
    isCompleting: boolean;
    isPreparing: boolean;
    prepareError: Nullable<Error>;
    completeError: Nullable<Error>;
    hasCancelled: boolean;
}

const derivePaymentState = ({
    completionResult,
    isCompleting,
    isPreparing,
    prepareError,
    completeError,
    hasCancelled,
}: IDerivePaymentStateParams): PaymentState => {
    if (completionResult) {
        return { status: 'completed', result: completionResult };
    }
    if (isCompleting) {
        return { status: 'completing' };
    }
    if (isPreparing) {
        return { status: 'preparing' };
    }
    if (prepareError) {
        return { status: 'ready-to-pay', notice: getErrorMessage(prepareError, 'Failed to prepare payment') };
    }
    if (completeError) {
        return { status: 'ready-to-pay', notice: getErrorMessage(completeError, 'Failed to complete order. You have not been charged — any pending hold on your card will be released.') };
    }
    if (hasCancelled) {
        return { status: 'ready-to-pay', notice: 'Order payment cancelled. You have not been charged.' };
    }
    return { status: 'ready-to-pay' };
};

export const useCafePaymentFlow = ({
    cafeId,
    items,
}: IUseCafePaymentFlowParams): ICafePaymentFlowResult => {
    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();
    const preparePayment = usePreparePaymentMutation();
    const completeOrder = useCompleteOrderMutation();
    const { alias, phoneNumber, isValid: isIdentityValid, fulfillmentType } = usePaymentIdentityContext();
    const [hasCancelled, setHasCancelled] = useState(false);

    const startPaymentFlow = usePaymentCoordinationStore(state => state.startPaymentFlow);
    const endPaymentFlow = usePaymentCoordinationStore(state => state.endPaymentFlow);
    const startCompleting = usePaymentCoordinationStore(state => state.startCompleting);
    const endCompleting = usePaymentCoordinationStore(state => state.endCompleting);
    const isOtherPaymentActive = useIsOtherPaymentActive(cafeId);

    // Track this cafe's send-to-kitchen so the coordination hook's unload guard
    // blocks while it's in flight — without gating other cafes' Pay buttons.
    useEffect(() => {
        if (!completeOrder.isPending) {
            return;
        }

        startCompleting(cafeId);
        return () => endCompleting(cafeId);
    }, [completeOrder.isPending, cafeId, startCompleting, endCompleting]);

    // handlePay takes the modal lock before an async prepare round-trip, during
    // which the modal isn't open yet so no navigation guard is armed. Track whether
    // this cafe is still mounted so a leave mid-prepare releases the lock and skips
    // opening the modal on the page the user navigated to.
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const handlePay = useCallback(async () => {
        // Only one payment modal may be active at a time; bail if another cafe owns
        // the lock (its Pay button gating should already prevent reaching here).
        const { activeModal } = usePaymentCoordinationStore.getState();
        if (activeModal != null && activeModal.cafeId !== cafeId) {
            return;
        }

        if (!isIdentityValid || preparePayment.isPending || completeOrder.isPending) {
            return;
        }

        preparePayment.reset();
        completeOrder.reset();
        setHasCancelled(false);
        startPaymentFlow(cafeId);

        try {
            const prepareResult = await preparePayment.mutateAsync({
                cafeId,
                items: items.map(toOrderItem),
            });

            if (!isMountedRef.current) {
                endPaymentFlow(cafeId);
                return;
            }

            openPopup({
                id:   PAYMENT_POPUP_ID,
                // Close by popping history so Back/Forward can't resurrect the
                // torn-down payment state, and so closing doesn't strand a
                // duplicate order-page entry in history.
                popHistoryOnClose: true,
                body: <PaymentPopup
                    iframeUrl={prepareResult.iframeUrl}
                    onPaymentComplete={(paymentResult) => {
                        closePopup();
                        completeOrder.mutate({
                            pendingOrderId: prepareResult.pendingOrderId,
                            paymentToken:   paymentResult.token,
                            cardInfo:       paymentResult.cardInfo,
                            alias,
                            phoneNumber,
                            fulfillmentType,
                        });
                    }}
                    onClose={() => {
                        setHasCancelled(true);
                        closePopup();
                    }}
                />,
            });
        } catch {
            // Prepare failed and no modal opened, so release the lock here. (Once
            // the modal opens, the coordination observer releases on close.)
            endPaymentFlow(cafeId);
        }
    }, [isIdentityValid, preparePayment, completeOrder, cafeId, items, openPopup, closePopup, alias, phoneNumber, fulfillmentType, startPaymentFlow, endPaymentFlow]);

    const paymentState = useMemo(
        () => derivePaymentState({
            completionResult: completeOrder.data,
            isCompleting:     completeOrder.isPending,
            isPreparing:      preparePayment.isPending,
            prepareError:     preparePayment.error,
            completeError:    completeOrder.error,
            hasCancelled,
        }),
        [completeOrder.data, completeOrder.isPending, completeOrder.error, preparePayment.isPending, preparePayment.error, hasCancelled],
    );

    const hasUnavailableItems = useMemo(
        () => items.some(item => !item.isAvailable),
        [items],
    );

    const payAvailability = useMemo(
        () => derivePayAvailability({
            isReadyToPay: paymentState.status === 'ready-to-pay',
            isIdentityValid,
            hasUnavailableItems,
            isOtherPaymentActive,
        }),
        [paymentState.status, isIdentityValid, hasUnavailableItems, isOtherPaymentActive],
    );

    return { handlePay, paymentState, payAvailability, hasUnavailableItems };
};
