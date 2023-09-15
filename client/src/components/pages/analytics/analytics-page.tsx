import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { AnalyticsClient } from '../../../api/analytics.ts';
import { addDurationToDate } from '../../../util/date.ts';
import Duration from '@arcticzeroo/duration';
import './analytics-page.css';

const VisitorChart = React.lazy(() => import('./visitor-chart.tsx'));

const getDefaultAfterDate = () => {
    const oneWeekAgo = addDurationToDate(new Date(), new Duration({ days: -7 }));
    oneWeekAgo.setMinutes(0, 0, 0)
    return AnalyticsClient.getDateString(oneWeekAgo);
};

const getMinimumDate = () => {
    const thirtyFiveDaysAgo = addDurationToDate(new Date(), new Duration({ days: -35 }));
    thirtyFiveDaysAgo.setMinutes(0, 0, 0);
    return AnalyticsClient.getDateString(thirtyFiveDaysAgo);
};

export const AnalyticsPage = () => {
    const [afterDate, setAfterDate] = useState(getDefaultAfterDate);

    const retrieveVisitsCallback = useCallback(() => AnalyticsClient.retrieveHourlyVisitCountAsync(afterDate), [afterDate]);

    const analyticsPromiseState = useDelayedPromiseState(retrieveVisitsCallback, true /*keepLastValue*/);

    useEffect(() => {
        analyticsPromiseState.run();
    }, [retrieveVisitsCallback]);

    const onAfterDateInputChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
        setAfterDate(event.target.value);
    };

    if ([PromiseStage.notRun, PromiseStage.running].includes(analyticsPromiseState.stage)) {
        return (
            <div className="card">
                <div className="loading-spinner"/>
                <div>
                    Loading visit data...
                </div>
            </div>
        );
    }

    if (analyticsPromiseState.stage === PromiseStage.error || analyticsPromiseState.value == null) {
        return (
            <div className="error-card">
                <div>
                    Could not load visit data!
                </div>
                <button onClick={analyticsPromiseState.run}>
                    Retry
                </button>
            </div>
        );
    }

    const visits = analyticsPromiseState.value;

    return (
        <div className="card" id="analytics-page">
            <div className="title">
                User Analytics
            </div>
            <div className="body">
                <div id="after-selector">
                    <label htmlFor="after-date">
                        Since date:
                    </label>
                    <input type="datetime-local"
                           id="after-date"
                           value={afterDate}
                           min={getMinimumDate()}
                           max={AnalyticsClient.getDateString(new Date())}
                           onChange={onAfterDateInputChanged}/>
                </div>
                <Suspense fallback={<div>Loading chart...</div>}>
                    <VisitorChart visits={visits}/>
                </Suspense>
            </div>
        </div>
    );
};