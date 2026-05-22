import React, { Suspense } from 'react';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.js';

const OrderPageLayout = React.lazy(() => import('./order-page.tsx').then(module => ({ default: module.OrderPageLayout })));

const OrderPageFallback = () => (
    <div className="centered-content">
        <div className="card flex">
            <HourglassLoadingSpinner/>
            <span>
                Loading Order Page...
            </span>
        </div>
    </div>
);

export const LazyOrderPage = () => (
    <Suspense fallback={<OrderPageFallback/>}>
        <OrderPageLayout/>
    </Suspense>
);
