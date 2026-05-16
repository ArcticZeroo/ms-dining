import React, { useMemo } from 'react';
import { useOrderingStore, IPaymentFormData } from '../../../store/zustand/ordering.ts';
import { CafePaymentRow } from './cafe-payment-row.tsx';

import './multi-cafe-payment.css';

interface ICafePaymentProps {
    formData: IPaymentFormData;
}

export const CafePayment: React.FC<ICafePaymentProps> = ({ formData }) => {
    const paymentsByCafeId = useOrderingStore((state) => state.paymentsByCafeId);
    const cafeIds = useMemo(() => Array.from(paymentsByCafeId.keys()), [paymentsByCafeId]);

    const completedCount = useMemo(
        () => {
            let count = 0;
            for (const slice of paymentsByCafeId.values()) {
                if (slice.completionResult != null) {
                    count++;
                }
            }
            return count;
        },
        [paymentsByCafeId]
    );

    const popupId = useMemo(() => Symbol('rguest-payment'), []);

    return (
        <div className="multi-cafe-payment card">
            <div className="title">
                Complete Payment
            </div>
            {cafeIds.length > 1 && (
                <>
                    <p className="multi-cafe-payment-description">
                        Your order spans {cafeIds.length} cafes. Pay for each one below.
                    </p>
                    <div className="multi-cafe-payment-progress">
                        {completedCount} of {cafeIds.length} paid
                    </div>
                </>
            )}
            <div className="multi-cafe-payment-list">
                {cafeIds.map((cafeId) => (
                    <CafePaymentRow
                        key={cafeId}
                        cafeId={cafeId}
                        formData={formData}
                        popupId={popupId}
                        disabled={false}
                    />
                ))}
            </div>
        </div>
    );
};
