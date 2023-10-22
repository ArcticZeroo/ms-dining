import { useEffect, useState } from 'react';
import Duration from '@arcticzeroo/duration';
import { DiningClient } from '../../api/dining.ts';

import './notice.css';

const updateIntervalMs = new Duration({ minutes: 1 }).inMilliseconds;

export const OutOfDateNotice = () => {
    const [isProbablyOutdated, setIsProbablyOutdated] = useState(false);
    const [isAcknowledged, setIsAcknowledged] = useState(false);

    const doUpdateStatus = () => {
        setIsProbablyOutdated(DiningClient.isMenuProbablyOutdated);
    };

    useEffect(() => {
        const timerId = setInterval(doUpdateStatus, updateIntervalMs);

        doUpdateStatus();

        return () => clearInterval(timerId);
    }, []);

    useEffect(() => {
        if (isProbablyOutdated) {
            setIsAcknowledged(false);
        }
    }, [isProbablyOutdated]);

    if (!isProbablyOutdated || isAcknowledged) {
        return null;
    }

    return (
        <div className="notice">
            Menus are updated daily at 9am pacific time. You may be viewing outdated menus.
            <button onClick={() => setIsAcknowledged(true)}>
                OK
            </button>
        </div>
    );
}