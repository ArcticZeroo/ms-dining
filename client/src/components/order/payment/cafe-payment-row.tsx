import { ICompleteOrderRequest } from '@msdining/common/models/cart';
import React, { useCallback, useContext, useMemo } from 'react';
import { ApplicationContext } from '../../../context/app.ts';
import { usePopupCloserAlways, usePopupOpener } from '../../../hooks/popup.ts';
import { useCafeCompleteMutation, useCafeRepreparePaymentMutation } from '../../../store/queries/ordering.ts';
import { useCartStore } from '../../../store/zustand/cart.ts';
import { ICafePaymentSlice, IPaymentFormData, useOrderingStore } from '../../../store/zustand/ordering.ts';
import { getViewName } from '../../../util/cafe.ts';
import { formatPrice } from '../../../util/cart.ts';
import { classNames } from '../../../util/react.ts';
import { IRguestPaymentResult, PaymentIframe } from './payment-iframe.tsx';

interface ICafePaymentRowProps {
    cafeId: string;
    formData: IPaymentFormData;
    popupId: symbol;
    disabled: boolean;
}

const buildCompleteRequest = (
    slice: ICafePaymentSlice,
    formData: IPaymentFormData,
    paymentResult: IRguestPaymentResult,
): ICompleteOrderRequest => ({
    orderId:                    slice.orderId,
    paymentToken:               paymentResult.token,
    cardInfo:                   paymentResult.cardInfo,
    alias:                      formData.alias,
    phoneNumberWithCountryCode: formData.phoneNumberWithCountryCode,
});

export const CafePaymentRow: React.FC<ICafePaymentRowProps> = ({ cafeId, formData, popupId, disabled }) => {
    const { viewsById } = useContext(ApplicationContext);
    const slice = useOrderingStore((state) => state.paymentsByCafeId.get(cafeId));
    const cart = useCartStore((state) => state.items);
    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();

    const reprepareMutation = useCafeRepreparePaymentMutation(cafeId, slice?.orderId ?? '');
    const completeMutation = useCafeCompleteMutation();

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
        if (!slice) {
            return;
        }

        openPopup({
            id:   popupId,
            body: (
                <PaymentIframe
                    iframeUrl={iframeUrl}
                    onPaymentComplete={async (paymentResult): Promise<void> => {
                        await completeMutation.mutateAsync({
                            cafeId,
                            request: buildCompleteRequest(slice, formData, paymentResult),
                        });
                        closePopup();
                    }}
                    onPaymentError={(error) => {
                        useOrderingStore.getState().setError(cafeId, error);
                    }}
                    onClose={() => {
                        // The single-use iframe URL is consumed once opened; the
                        // next "Pay" click will re-prepare a fresh URL.
                        useOrderingStore.getState().setIframeUrl(cafeId, undefined);
                        closePopup();
                    }}
                />
            ),
        });
    }, [openPopup, popupId, completeMutation, formData, closePopup, cafeId, slice]);

    const handlePay = useCallback(async () => {
        if (!slice) {
            return;
        }

        if (slice.iframeUrl) {
            openPaymentPopup(slice.iframeUrl);
            return;
        }

        const fresh = await reprepareMutation.mutateAsync();
        openPaymentPopup(fresh.iframeUrl);
    }, [slice, reprepareMutation, openPaymentPopup]);

    if (!slice) {
        return null;
    }

    const isBusy = reprepareMutation.isPending || completeMutation.isPending;
    const buttonLabel = reprepareMutation.isPending
        ? 'Preparing...'
        : completeMutation.isPending
            ? 'Completing...'
            : 'Pay';

    return (
        <div
            className={classNames(
                'multi-cafe-payment-row',
                slice.completionResult && 'completed',
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
            {slice.error && (
                <div className="multi-cafe-payment-row-error">
                    {slice.error}
                </div>
            )}
            <div className="multi-cafe-payment-row-action">
                {slice.completionResult ? (
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
