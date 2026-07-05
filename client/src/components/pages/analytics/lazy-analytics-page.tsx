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

// eslint-disable-next-line react/no-multi-comp -- AnalyticsPageFallback is a co-located Suspense fallback used only here
export const LazyAnalyticsPage = () => (
    <Suspense fallback={<AnalyticsPageFallback/>}>
        <AnalyticsPage/>
    </Suspense>
);
