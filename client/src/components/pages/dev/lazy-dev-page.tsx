import React, { Suspense } from 'react';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.js';

const DevPage = React.lazy(() => import('./dev-page.js').then((module) => ({ default: module.DevPage })));

const DevPageFallback = () => (
    <div className="card">
        <HourglassLoadingSpinner/>
        <span>
            Loading Dev Page...
        </span>
    </div>
);

// eslint-disable-next-line react/no-multi-comp -- DevPageFallback is a co-located Suspense fallback used only here
export const LazyDevPage = () => (
    <Suspense fallback={<DevPageFallback/>}>
        <DevPage/>
    </Suspense>
);