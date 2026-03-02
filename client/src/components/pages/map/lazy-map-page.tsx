import React, { Suspense } from 'react';

const MapPage = React.lazy(() => import('./map-page.tsx').then(module => ({ default: module.MapPage })));

export const LazyMapPage = () => (
    <Suspense>
        <MapPage/>
    </Suspense>
);
