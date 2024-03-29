import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { IWaitTimeResponse } from '@msdining/common/dist/models/http';
import { useCallback, useEffect, useMemo } from 'react';
import { DiningClient } from '../../api/dining.ts';
import { CartContext } from '../../context/cart.ts';
import { useValueNotifierContext } from '../../hooks/events.ts';

export const WaitTime = () => {
    const cartItemsByCafeId = useValueNotifierContext(CartContext);

    const retrieveWaitTime = useCallback(
        async (): Promise<IWaitTimeResponse> => {
            const waitTimePromises: Array<Promise<IWaitTimeResponse>> = [];

            for (const [cafeId, cafeCartItems] of cartItemsByCafeId) {
                const totalQuantity = Array.from(cafeCartItems.values()).reduce((total, item) => total + item.quantity, 0);
                waitTimePromises.push(DiningClient.retrieveWaitTimeForItems(cafeId, totalQuantity));
            }

            const waitTimes = await Promise.all(waitTimePromises);

            const waitTime: IWaitTimeResponse = {
                minTime: 0,
                maxTime: 0,
            };

            for (const wait of waitTimes) {
                waitTime.minTime = Math.max(waitTime.minTime, wait.minTime);
                waitTime.maxTime = Math.max(waitTime.maxTime, wait.maxTime);
            }

            if (waitTime.minTime === Number.MAX_SAFE_INTEGER) {
                waitTime.minTime = 0;
            }

            return waitTime;
        },
        [cartItemsByCafeId]
    );

    const waitTimeState = useDelayedPromiseState(retrieveWaitTime);
    const runWaitTimePromise = waitTimeState.run;

    useEffect(() => {
        runWaitTimePromise();
    }, [runWaitTimePromise]);

    const waitTimeView = useMemo(
        () => {
            if (waitTimeState.stage === PromiseStage.running) {
                return 'Loading wait time...';
            }

            if (waitTimeState.value != null) {
                return `Estimated wait time: ${waitTimeState.value.minTime} - ${waitTimeState.value.maxTime} minutes`;
            }

            return 'Error retrieving wait time';

        },
        [waitTimeState]
    );

    return (
        <div className="centered-content">
            {waitTimeView}
        </div>
    );
}