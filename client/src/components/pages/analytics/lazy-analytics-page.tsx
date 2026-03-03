import React, { Suspense } from 'react';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.js';

const AnalyticsPage = React.lazy(() => import('./analytics-page.tsx').then(module => ({ default: module.AnalyticsPage })));

const AnalyticsPageFallback = () => (
    <div className="card">
        <HourglassLoadingSpinner/>
        <span>
            Loading Analytics...
        </span>
    </div>
);

export const LazyAnalyticsPage = () => (
    <Suspense fallback={<AnalyticsPageFallback/>}>
        <AnalyticsPage/>
    </Suspense>
);
