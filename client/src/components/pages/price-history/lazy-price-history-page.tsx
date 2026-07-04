import React, { Suspense } from 'react';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.js';

const PriceHistoryPage = React.lazy(() => import('./price-history-page.tsx').then(module => ({ default: module.PriceHistoryPage })));

export const LazyPriceHistoryPage = () => (
    <Suspense fallback={(
        <div className="card">
            <HourglassLoadingSpinner/>
            <span>
                Loading Price History...
            </span>
        </div>
    )}>
        <PriceHistoryPage/>
    </Suspense>
);
