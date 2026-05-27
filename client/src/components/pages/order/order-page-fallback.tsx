import type React from 'react';
import { Route, Routes } from 'react-router-dom';

import './order-page.css';

const SkeletonCard = ({ height = '4rem', style }: { height?: string; style?: React.CSSProperties }) => (
    <div className="card" style={{ height, ...style }}/>
);

const CheckoutSkeleton = () => (
    <div id="order-checkout" className="flex-col loading-skeleton">
        <div className="card flex" style={{ gap: 'var(--default-padding)' }}>
            <SkeletonCard height="4rem" style={{ flex: 1 }}/>
            <SkeletonCard height="4rem" style={{ flex: 1 }}/>
        </div>
        <div className="card flex-col" style={{ gap: 'var(--default-padding)' }}>
            <SkeletonCard height="1.5rem" style={{ width: '40%', alignSelf: 'center' }}/>
            <SkeletonCard height="2rem"/>
            <SkeletonCard height="2rem"/>
            <SkeletonCard height="2rem" style={{ width: '30%', alignSelf: 'flex-end' }}/>
        </div>
    </div>
);

const CompletedOrdersSkeleton = () => (
    <div className="flex-col loading-skeleton">
        <SkeletonCard height="2rem"/>
        <SkeletonCard height="8rem"/>
        <SkeletonCard height="8rem"/>
    </div>
);

const HistorySkeleton = () => (
    <div id="order-history" className="flex-col loading-skeleton">
        <SkeletonCard height="5rem"/>
        <SkeletonCard height="8rem"/>
        <SkeletonCard height="8rem"/>
    </div>
);

export const OrderPageFallback = () => (
    <Routes>
        <Route index element={<CheckoutSkeleton/>}/>
        <Route path="done" element={<CompletedOrdersSkeleton/>}/>
        <Route path="history" element={<HistorySkeleton/>}/>
        <Route path="*" element={<CheckoutSkeleton/>}/>
    </Routes>
);
