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
    notice: string | undefined;
    completionResult: ICompleteOrderResult | undefined;
    isBusy: boolean;
    isPaymentModalOpen: boolean;
}

interface IGetPaymentFlowErrorParams {
    prepareError: Nullable<Error>;
    completeError: Nullable<Error>;
    hasPaid: boolean;
    hasCancelled: boolean;
}

const getError = ({ prepareError, completeError, hasPaid, hasCancelled }: IGetPaymentFlowErrorParams) => {
    if (prepareError) {
        return getErrorMessage(prepareError, 'Failed to prepare payment');
    }

    if (completeError) {
        if (hasPaid) {
            return getErrorMessage(completeError, 'You have not been charged - any pending charge on your card will go away within a few days. Failed to complete order');
        }

        return getErrorMessage(completeError, 'Failed to complete order');
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

    const isBusy = preparePayment.isPending || completeOrder.isPending;
    const completionResult = completeOrder.data;
    const [hasPaid, setHasPaid] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [hasCancelled, setHasCancelled] = useState(false);

    const notice = getError({
        prepareError: preparePayment.error,
        completeError: completeOrder.error,
        hasPaid,
        hasCancelled
    });

    const handleClosePopup = useCallback(() => {
        closePopup();
        setIsOpen(false);
    }, [closePopup]);

    const handlePay = useCallback(async () => {
        if (!isIdentityValid || isBusy) {
            return;
        }

        preparePayment.reset();
        completeOrder.reset();

        try {
            const prepareResult = await preparePayment.mutateAsync({
                cafeId,
                items: items.map(toOrderItem),
            });

            setIsOpen(true);

            openPopup({
                id:   paymentPopupId,
                body: <PaymentPopup
                    iframeUrl={prepareResult.iframeUrl}
                    onPaymentComplete={async (paymentResult) => {
                        setHasPaid(true);
                        await completeOrder.mutateAsync({
                            pendingOrderId: prepareResult.pendingOrderId,
                            paymentToken:   paymentResult.token,
                            cardInfo:       paymentResult.cardInfo,
                            alias:          alias,
                            phoneNumber:    phoneNumber,
                        });
                        handleClosePopup();
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

    return { handlePay, notice, completionResult, isBusy, isPaymentModalOpen: isOpen };
};
