import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ICompleteOrderResponse, IPrepareOrderResponse } from '@msdining/common/models/cart';
import { ApplicationContext } from '../../../context/app.ts';
import { CartContext } from '../../../context/cart.ts';
import { useValueNotifierContext } from '../../../hooks/events.ts';
import { usePopupCloserAlways, usePopupOpener } from '../../../hooks/popup.ts';
import { OrderingClient } from '../../../api/order.ts';
import { classNames } from '../../../util/react.ts';
import { PaymentIframe } from './payment-iframe.tsx';

import './multi-cafe-payment.css';

interface IMultiCafePaymentProps {
    prepareResults: IPrepareOrderResponse;
    alias: string;
    onAllComplete: (results: ICompleteOrderResponse) => void;
}

export const MultiCafePayment: React.FC<IMultiCafePaymentProps> = ({ prepareResults, alias, onAllComplete }) => {
    const { viewsById } = useContext(ApplicationContext);
    const cart = useValueNotifierContext(CartContext);
    const openPopup = usePopupOpener();
    const closePopup = usePopupCloserAlways();

    const popupId = useMemo(() => Symbol('rguest-multi-payment'), []);

    const [completedResults, setCompletedResults] = useState<ICompleteOrderResponse>({});
    const [activeCafeId, setActiveCafeId] = useState<string | null>(null);

    const cafeEntries = useMemo(() => Object.entries(prepareResults), [prepareResults]);

    useEffect(() => {
        const completedCount = Object.keys(completedResults).length;
        if (completedCount > 0 && completedCount >= cafeEntries.length) {
            onAllComplete(completedResults);
        }
    }, [completedResults, cafeEntries.length, onAllComplete]);

    const handlePayForCafe = useCallback((cafeId: string) => {
        const cafeData = prepareResults[cafeId];
        if (!cafeData?.iframeUrl) {
            return;
        }

        setActiveCafeId(cafeId);

        openPopup({
            id:   popupId,
            body: (
                <PaymentIframe
                    iframeUrl={cafeData.iframeUrl}
                    onPaymentComplete={async (result) => {
                        const completeResult = await OrderingClient.completeOrder({
                            orderIds:     { [cafeId]: cafeData.orderId },
                            paymentToken: result.token,
                            cardInfo:     result.cardInfo,
                            alias,
                        });
                        setCompletedResults(prev => ({ ...prev, ...completeResult }));
                        setActiveCafeId(null);
                        closePopup();
                    }}
                    onPaymentError={(error) => {
                        console.error(`Payment error for cafe ${cafeId}:`, error);
                    }}
                    onClose={() => {
                        setActiveCafeId(null);
                        closePopup();
                    }}
                />
            ),
        });
    }, [prepareResults, alias, popupId, openPopup, closePopup]);

    const getCafeTotal = useCallback((cafeId: string): number => {
        const cafeItems = cart.get(cafeId);
        if (!cafeItems) {
            return 0;
        }
        let total = 0;
        for (const item of cafeItems.values()) {
            total += item.price;
        }
        return total;
    }, [cart]);

    const completedCount = Object.keys(completedResults).length;

    return (
        <div className="multi-cafe-payment card">
            <div className="title">
                Complete Payment
            </div>
            <p className="multi-cafe-payment-description">
                Your order spans {cafeEntries.length} cafes. Pay for each one below.
            </p>
            <div className="multi-cafe-payment-progress">
                {completedCount} of {cafeEntries.length} paid
            </div>
            <div className="multi-cafe-payment-list">
                {cafeEntries.map(([cafeId]) => {
                    const isCompleted = cafeId in completedResults;
                    const isActive = activeCafeId === cafeId;
                    const cafeName = viewsById.get(cafeId)?.value.name ?? cafeId;
                    const cafeTotal = getCafeTotal(cafeId);

                    return (
                        <div
                            key={cafeId}
                            className={classNames(
                                'multi-cafe-payment-row',
                                isCompleted && 'completed',
                            )}
                        >
                            <div className="multi-cafe-payment-row-info">
                                <span className="multi-cafe-payment-cafe-name">{cafeName}</span>
                                {cafeTotal > 0 && (
                                    <span className="multi-cafe-payment-total">
                                        ${cafeTotal.toFixed(2)}
                                    </span>
                                )}
                            </div>
                            <div className="multi-cafe-payment-row-action">
                                {isCompleted ? (
                                    <span className="multi-cafe-payment-check" title="Paid">✅</span>
                                ) : (
                                    <button
                                        className="default-container"
                                        onClick={() => handlePayForCafe(cafeId)}
                                        disabled={activeCafeId != null}
                                    >
                                        {isActive ? 'Paying...' : 'Pay'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
