import Duration from '@arcticzeroo/duration';
import { useCallback, useEffect, useState } from 'react';
import { DiningClient } from '../../api/client/dining.ts';
import { SelectedDateContext } from '../../context/time.ts';
import { useValueNotifierContext } from '../../hooks/events.ts';
import { classNames } from '../../util/react.ts';

import './notice.css';

const updateIntervalMs = new Duration({ minutes: 1 }).inMilliseconds;

export const FutureMenuOutOfDateNotice = () => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    const [isProbablyOutdated, setIsProbablyOutdated] = useState(false);

    const doUpdateStatus = useCallback(() => {
        setIsProbablyOutdated(DiningClient.isMenuProbablyOutdated(selectedDate));
    }, [selectedDate]);

    useEffect(() => {
        doUpdateStatus();

        const timerId = setInterval(doUpdateStatus, updateIntervalMs);

        return () => clearInterval(timerId);
    }, [doUpdateStatus]);

    return (
        <div className={classNames('notice', isProbablyOutdated && 'visible')}>
            <span className="material-symbols-outlined">
                warning
            </span>
            This menu could change by the time it is available.
        </div>
    );
};