import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import { AnalyticsClient } from '../../../api/analytics.ts';
import './analytics-page.css';
import { pluralize } from '../../../util/string.ts';
import { classNames } from '../../../util/react.ts';

const VisitorChart = React.lazy(() => import('./visitor-chart.tsx'));

const dayOptions: number[] = [
    1,
    7,
    30
];

export const AnalyticsPage = () => {
    const [currentDaysAgo, setCurrentDaysAgo] = useState(7);

    const retrieveVisitsCallback = useCallback(() => AnalyticsClient.retrieveHourlyVisitCountAsync(currentDaysAgo), [currentDaysAgo]);

    const analyticsPromiseState = useDelayedPromiseState(retrieveVisitsCallback, true /*keepLastValue*/);

    useEffect(() => {
        analyticsPromiseState.run();
    }, [retrieveVisitsCallback]);

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
                    {
                        dayOptions.map(daysAgoOption => (
                            <button
                                className={classNames('days-ago-option', daysAgoOption === currentDaysAgo && 'active')}
                                onClick={() => setCurrentDaysAgo(daysAgoOption)}>
                                {daysAgoOption} {pluralize('Day', daysAgoOption)}
                            </button>
                        ))
                    }
                </div>
                <Suspense fallback={<div>Loading chart...</div>}>
                    <VisitorChart visits={visits}/>
                </Suspense>
            </div>
        </div>
    );
};