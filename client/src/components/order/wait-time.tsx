import type { IActiveOrderSummary } from '@msdining/common/models/cart';
import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../context/app.ts';
import { useServerCartActiveOrder } from '../../store/zustand/server-cart.ts';
import { getViewName } from '../../util/cafe.ts';
import { formatWaitTime } from '../../util/order.ts';

interface IWaitTimeProps {
    activeOrder?: IActiveOrderSummary;
}

export const WaitTime: React.FC<IWaitTimeProps> = ({ activeOrder: overrideActiveOrder }) => {
    const { viewsById } = useContext(ApplicationContext);
    const storeActiveOrder = useServerCartActiveOrder();
    const activeOrder = overrideActiveOrder ?? storeActiveOrder;

    const waitTimes = useMemo(() => (activeOrder?.cafeParts ?? [])
        .filter(part => part.waitTimeMin != null && part.waitTimeMax != null)
        .map((part) => {
            const view = viewsById.get(part.cafeId);
            return {
                cafeId:   part.cafeId,
                cafeName: view ? getViewName({ view, showGroupName: true }) : part.cafeId,
                label:    formatWaitTime(part.waitTimeMin!, part.waitTimeMax!),
            };
        }), [activeOrder?.cafeParts, viewsById]);

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
                    {waitTime.label}
                </div>
            ))}
        </div>
    );
};
