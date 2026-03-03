import React, { Suspense } from 'react';
import { HourglassLoadingSpinner } from '../../icon/hourglass-loading-spinner.js';

const OrderPage = React.lazy(() => import('./order-page.tsx').then(module => ({ default: module.OrderPage })));

const OrderPageFallback = () => (
    <div className="card">
        <HourglassLoadingSpinner/>
        <span>
            Loading Order Page...
        </span>
    </div>
);

export const LazyOrderPage = () => (
    <Suspense fallback={<OrderPageFallback/>}>
        <OrderPage/>
    </Suspense>
);
