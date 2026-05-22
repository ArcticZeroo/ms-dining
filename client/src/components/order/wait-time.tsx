import type { IActiveOrderSummary } from '@msdining/common/models/cart';
import type { ICheckoutResult } from '@msdining/common/models/order';
import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { getViewName } from '../../util/cafe.ts';

interface IWaitTimeProps {
    checkoutResult?: ICheckoutResult;
    activeOrder?: IActiveOrderSummary;
}

export const WaitTime: React.FC<IWaitTimeProps> = ({ checkoutResult, activeOrder }) => {
    const { viewsById } = useContext(ApplicationContext);

    const waitTimes = useMemo(() => {
        const parts = activeOrder?.cafeParts ?? checkoutResult?.cafeResults ?? [];

        return parts
            .filter(part => part.waitTimeMin != null && part.waitTimeMax != null)
            .map((part) => {
                const view = viewsById.get(part.cafeId);
                return {
                    cafeId:   part.cafeId,
                    cafeName: view ? getViewName({ view, showGroupName: true }) : part.cafeId,
                    waitTimeMin: part.waitTimeMin,
                    waitTimeMax: part.waitTimeMax,
                };
            });
    }, [activeOrder?.cafeParts, checkoutResult?.cafeResults, viewsById]);

    if (waitTimes.length === 0) {
        return null;
    }

    return (
        <div className="wait-time">
            <div>
                {waitTimes.length === 1 ? 'Estimated wait time:' : 'Estimated wait times:'}
            </div>
            {waitTimes.map((waitTime) => (
                <div key={waitTime.cafeId}>
                    {waitTimes.length > 1 && `${waitTime.cafeName}: `}
                    {waitTime.waitTimeMin} - {waitTime.waitTimeMax} minutes
                </div>
            ))}
        </div>
    );
};