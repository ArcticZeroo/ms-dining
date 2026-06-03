import React, { Suspense } from 'react';

const ConnectorStopsPage = React.lazy(() => import('./connector-stops-page.tsx').then(module => ({ default: module.ConnectorStopsPage })));

export const LazyConnectorStopsPage = () => (
    <Suspense>
        <ConnectorStopsPage/>
    </Suspense>
);
