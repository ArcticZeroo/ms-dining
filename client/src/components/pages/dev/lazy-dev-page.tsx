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

export const LazyDevPage = () => (
    <Suspense fallback={<DevPageFallback/>}>
        <DevPage/>
    </Suspense>
);