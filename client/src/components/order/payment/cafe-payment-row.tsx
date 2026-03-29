import React, { useCallback, useContext, useMemo } from 'react';
import { IOrderCompletionData, IPreparePaymentResponse } from '@msdining/common/models/cart';
import { ApplicationContext } from '../../../context/app.ts';
import { CartContext } from '../../../context/cart.ts';
import { useValueNotifierContext } from '../../../hooks/events.ts';
import { usePopupCloserAlways, usePopupOpener } from '../../../hooks/popup.ts';
import { useCafePayment } from '../../../hooks/order.ts';
import { formatPrice } from '../../../util/cart.ts';
import { getViewName } from '../../../util/cafe.ts';
import { classNames } from '../../../util/react.ts';
import { PaymentIframe } from './payment-iframe.tsx';

interface ICafePaymentRowProps {
    cafeId: string;
    initialPrepareData: IPreparePaymentResponse;
    formData: { phoneNumberWithCountryCode: string; alias: string };
    popupId: symbol;
    disabled: boolean;
    onComplete: (cafeId: string, result: IOrderCompletionData) => void;
}

export const CafePaymentRow: React.FC<ICafePaymentRowProps> = ({ cafeId, initialPrepareData, formData, popupId, disabled, onComplete }) => {
    const { viewsById } = useContext(ApplicationContext);
    const cart = useValueNotifierContext(CartContext);
    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();

    const { state, prepare, complete, invalidatePrepare, setError } = useCafePayment(cafeId, initialPrepareData, formData);

    const view = viewsById.get(cafeId);
    const cafeName = view
        ? getViewName({ view, showGroupName: true })
        : cafeId;

    const cafeTotal = useMemo(() => {
        const cafeItems = cart.get(cafeId);
        if (!cafeItems) {
            return 0;
        }
        return Array.from(cafeItems.values()).reduce((sum, item) => sum + item.price, 0);
    }, [cart, cafeId]);

    const openPaymentPopup = useCallback((iframeUrl: string) => {
        openPopup({
            id:   popupId,
            body: (
                <PaymentIframe
                    iframeUrl={iframeUrl}
                    onPaymentComplete={async (result) => {
                        const completeResult = await complete(result);
                        closePopup();
                        onComplete(cafeId, completeResult);
                    }}
                    onPaymentError={(error) => {
                        setError(error);
                    }}
                    onClose={() => {
                        invalidatePrepare();
                        closePopup();
                    }}
                />
            ),
        });
    }, [openPopup, popupId, complete, closePopup, onComplete, cafeId, setError, invalidatePrepare]);

    const handlePay = useCallback(async () => {
        if (state.iframeUrl) {
            openPaymentPopup(state.iframeUrl);
            return;
        }

        await prepare();
    }, [state.iframeUrl, prepare, openPaymentPopup]);

    // After a re-prepare completes, auto-open if we now have an iframe URL
    // This is handled by the user clicking "Pay" again after an error/close

    const isBusy = state.isPreparing || state.isCompleting;
    const buttonLabel = state.isPreparing ? 'Preparing...' : state.isCompleting ? 'Completing...' : 'Pay';

    return (
        <div
            className={classNames(
                'multi-cafe-payment-row',
                state.completionResult && 'completed',
            )}
        >
            <div className="multi-cafe-payment-row-info">
                <span className="multi-cafe-payment-cafe-name">{cafeName}</span>
                {cafeTotal > 0 && (
                    <span className="multi-cafe-payment-total">
                        {formatPrice(cafeTotal)}
                    </span>
                )}
            </div>
            {state.error && (
                <div className="multi-cafe-payment-row-error">
                    {state.error}
                </div>
            )}
            <div className="multi-cafe-payment-row-action">
                {state.completionResult ? (
                    <span className="multi-cafe-payment-check" title="Paid">✅</span>
                ) : (
                    <button
                        className="default-container"
                        onClick={handlePay}
                        disabled={disabled || isBusy}
                    >
                        {buttonLabel}
                    </button>
                )}
            </div>
        </div>
    );
};
