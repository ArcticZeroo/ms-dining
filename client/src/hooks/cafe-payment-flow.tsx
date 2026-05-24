import { useCallback, useState } from 'react';
import type { ICompleteOrderResult, IOrderItem } from '@msdining/common/models/order';
import type { ICartItemRecord } from '@msdining/common/models/cart';
import { usePopupCloserAlways, usePopupOpener } from './popup.ts';
import { useCompleteOrderMutation, usePreparePaymentMutation } from '../store/queries/new-ordering.ts';
import { usePaymentIdentityContext } from '../context/payment-identity.ts';
import { getErrorMessage } from '../util/mutation.ts';
import { PaymentPopup } from '../components/pages/order/payment/payment-popup.tsx';
import type { Nullable } from '@msdining/common/models/util';

const paymentPopupId = Symbol('order-cafe-payment');

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

export interface ICafePaymentFlowResult {
    handlePay: () => void;
    retryCompletion: () => void;
    notice: string | undefined;
    completionResult: ICompleteOrderResult | undefined;
    isCompleting: boolean;
    isBusy: boolean;
}

const getNotice = (prepareError: Nullable<Error>, completeError: Nullable<Error>, hasCancelled: boolean) => {
    if (prepareError) {
        return getErrorMessage(prepareError, 'Failed to prepare payment');
    }

    if (completeError) {
        return getErrorMessage(completeError, 'Failed to complete order. You have not been charged — any pending hold on your card will be released.');
    }

    if (hasCancelled) {
        return 'Order payment cancelled. You have not been charged.';
    }

    return undefined;
}

export const useCafePaymentFlow = ({
    cafeId,
    items,
}: IUseCafePaymentFlowParams): ICafePaymentFlowResult => {
    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();
    const preparePayment = usePreparePaymentMutation();
    const completeOrder = useCompleteOrderMutation();
    const { alias, phoneNumber, isValid: isIdentityValid } = usePaymentIdentityContext();

    const isCompleting = completeOrder.isPending;
    const isBusy = preparePayment.isPending || isCompleting;
    const completionResult = completeOrder.data;
    const [hasCancelled, setHasCancelled] = useState(false);

    const notice = getNotice(preparePayment.error, completeOrder.error, hasCancelled);

    const handleClosePopup = useCallback(() => {
        closePopup();
    }, [closePopup]);

    const retryCompletion = useCallback(() => {
        completeOrder.reset();
        // Re-attempt uses the same pending order — the mutation variables are still set
        const vars = completeOrder.variables;
        if (vars) {
            completeOrder.mutate(vars);
        }
    }, [completeOrder]);

    const handlePay = useCallback(async () => {
        if (!isIdentityValid || isBusy) {
            return;
        }

        preparePayment.reset();
        completeOrder.reset();
        setHasCancelled(false);

        try {
            const prepareResult = await preparePayment.mutateAsync({
                cafeId,
                items: items.map(toOrderItem),
            });

            openPopup({
                id:   paymentPopupId,
                body: <PaymentPopup
                    iframeUrl={prepareResult.iframeUrl}
                    onPaymentComplete={(paymentResult) => {
                        handleClosePopup();
                        completeOrder.mutate({
                            pendingOrderId: prepareResult.pendingOrderId,
                            paymentToken:   paymentResult.token,
                            cardInfo:       paymentResult.cardInfo,
                            alias,
                            phoneNumber,
                        });
                    }}
                    onClose={() => {
                        setHasCancelled(true);
                        handleClosePopup();
                    }}
                />,
            });
        } catch {
            // Error is captured in preparePayment.error
        }
    }, [isIdentityValid, isBusy, preparePayment, completeOrder, cafeId, items, openPopup, handleClosePopup, alias, phoneNumber]);

    return { handlePay, retryCompletion, notice, completionResult, isCompleting, isBusy };
};
