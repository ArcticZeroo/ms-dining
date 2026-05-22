import type { IOrderCafePartSummary, OrderCafePartStatus } from '@msdining/common/models/cart';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { usePopupCloserAlways, usePopupOpener } from '../../../hooks/popup.ts';
import {
    useCompleteOrderMutation,
    usePreparePaymentMutation,
} from '../../../store/queries/new-ordering.ts';
import { getViewName } from '../../../util/cafe.ts';
import { formatPrice } from '../../../util/cart.ts';
import { getErrorMessage } from '../../../util/mutation.ts';
import { classNames } from '../../../util/react.ts';
import { PaymentIframe } from './payment-iframe.tsx';

interface ICafePaymentRowProps {
    orderId: string;
    value: IOrderCafePartSummary;
    popupId: symbol;
    disabled: boolean;
}

const getStatusLabel = (status: OrderCafePartStatus) => {
    switch (status) {
    case 'pending':
        return 'Ready for payment';
    case 'payment_pending':
        return 'Payment pending';
    case 'completed':
        return 'Completed';
    case 'failed':
        return 'Payment failed';
    case 'abandoned':
        return 'Cancelled';
    default:
        return status;
    }
};

export const CafePaymentRow: React.FC<ICafePaymentRowProps> = ({ orderId, value, popupId, disabled }) => {
    const { viewsById } = useContext(ApplicationContext);
    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();
    const preparePayment = usePreparePaymentMutation();
    const completeOrder = useCompleteOrderMutation();
    const [error, setError] = useState<string>();

    const view = viewsById.get(value.cafeId);
    const cafeName = view
        ? getViewName({ view, showGroupName: true })
        : value.cafeId;

    const canPay = value.status !== 'completed' && value.status !== 'abandoned';
    const waitTimeLabel = useMemo(() => {
        if (value.waitTimeMin == null || value.waitTimeMax == null) {
            return undefined;
        }

        return `${value.waitTimeMin} - ${value.waitTimeMax} min`;
    }, [value.waitTimeMax, value.waitTimeMin]);

    const openPaymentPopup = useCallback((iframeUrl: string) => {
        openPopup({
            id:   popupId,
            body: (
                <PaymentIframe
                    iframeUrl={iframeUrl}
                    onPaymentComplete={async (paymentResult): Promise<void> => {
                        await completeOrder.mutateAsync({
                            orderId,
                            cafeId: value.cafeId,
                            paymentToken: paymentResult.token,
                            cardInfo: paymentResult.cardInfo,
                        });

                        setError(undefined);
                        closePopup();
                    }}
                    onPaymentError={(paymentError) => {
                        setError(paymentError);
                    }}
                    onClose={closePopup}
                />
            ),
        });
    }, [closePopup, completeOrder, openPopup, orderId, popupId, value.cafeId]);

    const handlePay = useCallback(async () => {
        setError(undefined);

        try {
            const prepared = await preparePayment.mutateAsync({
                orderId,
                cafeId: value.cafeId,
            });

            openPaymentPopup(prepared.iframeUrl);
        } catch (prepareError) {
            setError(getErrorMessage(prepareError, 'Failed to prepare payment'));
        }
    }, [openPaymentPopup, orderId, preparePayment, value.cafeId]);

    const isBusy = preparePayment.isPending || completeOrder.isPending;
    const buttonLabel = preparePayment.isPending
        ? 'Preparing...'
        : completeOrder.isPending
            ? 'Completing...'
            : value.status === 'failed'
                ? 'Retry Payment'
                : 'Pay';

    return (
        <div
            className={classNames(
                'multi-cafe-payment-row',
                value.status === 'completed' && 'completed',
            )}
        >
            <div className="multi-cafe-payment-row-info">
                <span className="multi-cafe-payment-cafe-name">{cafeName}</span>
                {value.total != null && (
                    <span className="multi-cafe-payment-total">
                        Total: {formatPrice(value.total)}
                    </span>
                )}
                {waitTimeLabel && (
                    <span className="multi-cafe-payment-total">
                        Wait time: {waitTimeLabel}
                    </span>
                )}
                <span className="multi-cafe-payment-total">
                    Status: {getStatusLabel(value.status)}
                </span>
                {value.buyOnDemandOrderNumber && (
                    <span className="multi-cafe-payment-total">
                        Order #{value.buyOnDemandOrderNumber}
                    </span>
                )}
                {error && (
                    <div className="multi-cafe-payment-row-error">
                        {error}
                    </div>
                )}
            </div>
            <div className="multi-cafe-payment-row-action">
                {value.status === 'completed' ? (
                    <span className="multi-cafe-payment-check" title="Paid">✅</span>
                ) : canPay ? (
                    <button
                        className="default-container"
                        onClick={() => handlePay()}
                        disabled={disabled || isBusy}
                    >
                        {buttonLabel}
                    </button>
                ) : (
                    <span className="multi-cafe-payment-total">Cancelled</span>
                )}
            </div>
        </div>
    );
};
