import { useCallback, useState } from 'react';
import type { ICompleteOrderResult, IOrderItem } from '@msdining/common/models/order';
import type { ICartItemRecord } from '@msdining/common/models/cart';
import { usePopupCloserAlways, usePopupOpener } from './popup.ts';
import { useCompleteOrderMutation, usePreparePaymentMutation } from '../store/queries/new-ordering.ts';
import type { IPaymentIdentity } from './payment-identity.ts';
import { getErrorMessage } from '../util/mutation.ts';
import { type IRguestPaymentResult, PaymentIframe } from '../components/pages/order/payment/payment-iframe.tsx';

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
    const [error, setError] = useState<string>();
    const [completionResult, setCompletionResult] = useState<ICompleteOrderResult>();

    const isLocalBusy = preparePayment.isPending || completeOrder.isPending;

    const handlePay = useCallback(async () => {
        if (!isPayEnabled || isLocalBusy) {
            return;
        }

        setError(undefined);

        try {
            const prepareResult = await preparePayment.mutateAsync({
                cafeId,
                items: items.map(toOrderItem),
            });

            const onPaymentComplete = async (paymentResult: IRguestPaymentResult) => {
                try {
                    const result = await completeOrder.mutateAsync({
                        pendingOrderId: prepareResult.pendingOrderId,
                        paymentToken:   paymentResult.token,
                        cardInfo:       paymentResult.cardInfo,
                        alias:          paymentIdentity.alias,
                        phoneNumber:    paymentIdentity.phoneNumber,
                    });

                    setCompletionResult(result);
                    setError(undefined);
                    closePopup();
                } catch (completeError) {
                    setError(getErrorMessage(completeError, 'Failed to complete order'));
                    throw completeError;
                }
            };

            openPopup({
                id:   paymentPopupId,
                body: <PaymentIframe
                    iframeUrl={prepareResult.iframeUrl}
                    onPaymentComplete={onPaymentComplete}
                    onPaymentError={setError}
                    onClose={closePopup}
                />,
            });
        } catch (prepareError) {
            setError(getErrorMessage(prepareError, 'Failed to prepare payment'));
        }
    }, [cafeId, closePopup, completeOrder, isPayEnabled, isLocalBusy, items, openPopup, paymentIdentity, preparePayment]);

    return { handlePay, error, completionResult, isLocalBusy };
};
