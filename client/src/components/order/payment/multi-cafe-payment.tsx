import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IOrderCompletionData, IOrderCompletionResponse, IPrepareOrderResponse } from '@msdining/common/models/cart';
import { CafePaymentRow } from './cafe-payment-row.tsx';

import './multi-cafe-payment.css';

interface ICafePaymentProps {
    prepareResults: IPrepareOrderResponse;
    formData: { phoneNumberWithCountryCode: string; alias: string };
    onAllComplete: (results: IOrderCompletionResponse) => void;
}

export const CafePayment: React.FC<ICafePaymentProps> = ({ prepareResults, formData, onAllComplete }) => {
    const cafeIds = useMemo(() => Object.keys(prepareResults), [prepareResults]);

    const [completedResults, setCompletedResults] = useState<IOrderCompletionResponse>({});

    const popupId = useMemo(() => Symbol('rguest-payment'), []);

    const handleCafeComplete = useCallback((cafeId: string, result: IOrderCompletionData) => {
        setCompletedResults(prev => ({ ...prev, [cafeId]: result }));
    }, []);

    useEffect(() => {
        const completedCount = Object.keys(completedResults).length;
        if (completedCount > 0 && completedCount >= cafeIds.length) {
            onAllComplete(completedResults);
        }
    }, [completedResults, cafeIds.length, onAllComplete]);

    const completedCount = Object.keys(completedResults).length;

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
                        initialPrepareData={prepareResults[cafeId]!}
                        formData={formData}
                        popupId={popupId}
                        disabled={false}
                        onComplete={handleCafeComplete}
                    />
                ))}
            </div>
        </div>
    );
};
