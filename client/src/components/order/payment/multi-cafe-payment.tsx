import type { IOrderCafePartSummary } from '@msdining/common/models/cart';
import type { ICompleteOrderResult } from '@msdining/common/models/order';
import React, { useMemo } from 'react';
import { CafePaymentRow } from './cafe-payment-row.tsx';

import './multi-cafe-payment.css';

interface IMultiCafePaymentProps {
    orderId: string;
    cafes: IOrderCafePartSummary[];
    isCancelling: boolean;
    onCompleted: (cafeId: string, result: ICompleteOrderResult) => void;
    onCancelOrder: () => void;
}

export const MultiCafePayment: React.FC<IMultiCafePaymentProps> = ({
    orderId,
    cafes,
    isCancelling,
    onCompleted,
    onCancelOrder,
}) => {
    const completedCount = useMemo(
        () => cafes.filter(cafe => cafe.status === 'completed').length,
        [cafes],
    );
    const popupId = useMemo(() => Symbol('rguest-payment'), []);

    if (cafes.length === 0) {
        return null;
    }

    return (
        <div className="multi-cafe-payment card">
            <div className="title">
                Complete Payment
            </div>
            {cafes.length > 1 ? (
                <>
                    <p className="multi-cafe-payment-description">
                        Your order spans {cafes.length} cafes. Pay for each one below.
                    </p>
                    <div className="multi-cafe-payment-progress">
                        {completedCount} of {cafes.length} paid
                    </div>
                </>
            ) : (
                <p className="multi-cafe-payment-description">
                    Finish paying for your order below.
                </p>
            )}
            <div className="multi-cafe-payment-list">
                {cafes.map((cafe) => (
                    <CafePaymentRow
                        key={cafe.cafeId}
                        orderId={orderId}
                        value={cafe}
                        popupId={popupId}
                        disabled={isCancelling}
                        onCompleted={onCompleted}
                    />
                ))}
            </div>
            <div className="flex flex-justify-center">
                <button
                    className="default-container"
                    onClick={onCancelOrder}
                    disabled={isCancelling}
                >
                    {isCancelling ? 'Cancelling...' : 'Cancel Remaining Order'}
                </button>
            </div>
        </div>
    );
};
