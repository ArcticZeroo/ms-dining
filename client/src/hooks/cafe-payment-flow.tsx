import { useCallback } from 'react';
import type { ICompleteOrderResult, IOrderItem } from '@msdining/common/models/order';
import type { ICartItemRecord } from '@msdining/common/models/cart';
import { usePopupCloserAlways, usePopupOpener } from './popup.ts';
import { useCompleteOrderMutation, usePreparePaymentMutation } from '../store/queries/new-ordering.ts';
import type { IPaymentIdentity } from './payment-identity.ts';
import { getErrorMessage } from '../util/mutation.ts';
import { PaymentIframe } from '../components/pages/order/payment/payment-iframe.tsx';

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
    paymentIdentity: IPaymentIdentity;
    isPayEnabled: boolean;
}

export interface ICafePaymentFlowResult {
    handlePay: () => void;
    error: string | undefined;
    completionResult: ICompleteOrderResult | undefined;
    isLocalBusy: boolean;
}

export const useCafePaymentFlow = ({
    cafeId,
    items,
    paymentIdentity,
    isPayEnabled,
}: IUseCafePaymentFlowParams): ICafePaymentFlowResult => {
    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();
    const preparePayment = usePreparePaymentMutation();
    const completeOrder = useCompleteOrderMutation();

    const isLocalBusy = preparePayment.isPending || completeOrder.isPending;
    const completionResult = completeOrder.data;

    const error = preparePayment.error
        ? getErrorMessage(preparePayment.error, 'Failed to prepare payment')
        : completeOrder.error
            ? getErrorMessage(completeOrder.error, 'Failed to complete order')
            : undefined;

    const handlePay = useCallback(async () => {
        if (!isPayEnabled || isLocalBusy) {
            return;
        }

        preparePayment.reset();
        completeOrder.reset();

        try {
            const prepareResult = await preparePayment.mutateAsync({
                cafeId,
                items: items.map(toOrderItem),
            });

            openPopup({
                id:   paymentPopupId,
                body: <PaymentIframe
                    iframeUrl={prepareResult.iframeUrl}
                    onPaymentComplete={async (paymentResult) => {
                        await completeOrder.mutateAsync({
                            pendingOrderId: prepareResult.pendingOrderId,
                            paymentToken:   paymentResult.token,
                            cardInfo:       paymentResult.cardInfo,
                            alias:          paymentIdentity.alias,
                            phoneNumber:    paymentIdentity.phoneNumber,
                        });
                        closePopup();
                    }}
                    onPaymentError={() => {
                        // rGuest errors are displayed within the iframe popup itself.
                    }}
                    onClose={closePopup}
                />,
            });
        } catch {
            // Error is captured in preparePayment.error
        }
    }, [cafeId, closePopup, completeOrder, isPayEnabled, isLocalBusy, items, openPopup, paymentIdentity, preparePayment]);

    return { handlePay, error, completionResult, isLocalBusy };
};
