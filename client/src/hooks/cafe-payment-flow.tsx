import { useCallback, useMemo, useState } from 'react';
import type { ICompleteOrderResult, IOrderItem } from '@msdining/common/models/order';
import type { ICartItemRecord } from '@msdining/common/models/cart';
import type { Nullable } from '@msdining/common/models/util';
import { usePopupCloserAlways, usePopupOpener } from './popup.ts';
import { useCompleteOrderMutation, usePreparePaymentMutation } from '../store/queries/new-ordering.ts';
import { usePaymentIdentityContext } from '../context/payment-identity.ts';
import { getErrorMessage } from '../util/mutation.ts';
import { PaymentPopup } from '../components/pages/order/payment/payment-popup.tsx';

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

export type PaymentState =
    | { status: 'ready-to-pay'; notice?: string }
    | { status: 'preparing' }
    | { status: 'completing' }
    | { status: 'completed'; result: ICompleteOrderResult };

export interface ICafePaymentFlowResult {
    handlePay: () => void;
    paymentState: PaymentState;
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

    let notice: string | undefined;

    if (prepareError) {
        notice = getErrorMessage(prepareError, 'Failed to prepare payment');
    } else if (completeError) {
        notice = getErrorMessage(completeError, 'Failed to complete order. You have not been charged — any pending hold on your card will be released.');
    } else if (hasCancelled) {
        notice = 'Order payment cancelled. You have not been charged.';
    }

    return { status: 'ready-to-pay', notice };
};

export const useCafePaymentFlow = ({
    cafeId,
    items,
}: IUseCafePaymentFlowParams): ICafePaymentFlowResult => {
    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();
    const preparePayment = usePreparePaymentMutation();
    const completeOrder = useCompleteOrderMutation();
    const { alias, phoneNumber, isValid: isIdentityValid } = usePaymentIdentityContext();
    const [hasCancelled, setHasCancelled] = useState(false);

    const handlePay = useCallback(async () => {
        if (!isIdentityValid || preparePayment.isPending || completeOrder.isPending) {
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
                        closePopup();
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
                        closePopup();
                    }}
                />,
            });
        } catch {
            // Error is captured in preparePayment.error
        }
    }, [isIdentityValid, preparePayment, completeOrder, cafeId, items, openPopup, closePopup, alias, phoneNumber]);

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

    return { handlePay, paymentState };
};
