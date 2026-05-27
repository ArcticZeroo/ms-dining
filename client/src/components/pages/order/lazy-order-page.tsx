import React, { Suspense } from 'react';
import { OrderPageFallback } from './order-page-fallback.tsx';

const OrderPageLayout = React.lazy(() => import('./order-page.tsx').then(module => ({ default: module.OrderPageLayout })));

export const LazyOrderPage = () => (
    <Suspense fallback={<OrderPageFallback/>}>
        <OrderPageLayout/>
    </Suspense>
);
