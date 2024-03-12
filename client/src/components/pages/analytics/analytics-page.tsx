import { PromiseStage, useDelayedPromiseState } from '@arcticzeroo/react-promise-hook';
import React, { Suspense, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnalyticsClient } from '../../../api/analytics.ts';
import { ApplicationContext } from '../../../context/app.ts';
import { classNames } from '../../../util/react.ts';
import { pluralize } from '../../../util/string.ts';

import './analytics-page.css';
import { setPageData } from '../../../util/title.ts';
import { RetryButton } from '../../button/retry-button.tsx';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.tsx';

const VisitorChart = React.lazy(() => import('./visitor-chart.tsx'));

const dayOptions: number[] = [
    1,
    7,
    30
];

export const AnalyticsPage = () => {
    const { isTrackingEnabled } = useContext(ApplicationContext);
    const navigate = useNavigate();

    const [currentDaysAgo, setCurrentDaysAgo] = useState(7);

    const retrieveVisitsCallback = useCallback(() => AnalyticsClient.retrieveHourlyVisitCountAsync(currentDaysAgo), [currentDaysAgo]);

    const { stage: visitLoadingStage, run: loadVisits, value: visits } = useDelayedPromiseState(retrieveVisitsCallback, true /*keepLastValue*/);

    useEffect(() => {
        setPageData('User Analytics', 'View user analytics for the app');
    }, []);

    useEffect(() => {
        // Parent page
        if (!isTrackingEnabled) {
            navigate('/info');
        }
    }, [navigate, isTrackingEnabled]);

    useEffect(() => {
        loadVisits();
    }, [loadVisits]);

    if ([PromiseStage.notRun, PromiseStage.running].includes(visitLoadingStage)) {
        return (
            <div className="card">
                <HourglassLoadingSpinner/>
                <span>
                    Loading visit data...
                </span>
            </div>
        );
    }

    if (visitLoadingStage === PromiseStage.error || visits == null) {
        return (
            <div className="error-card">
                <div>
                    Could not load visit data!
                </div>
                <RetryButton onClick={loadVisits}/>
            </div>
        );
    }

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