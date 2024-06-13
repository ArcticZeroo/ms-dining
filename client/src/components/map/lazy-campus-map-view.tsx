import { ErrorBoundary } from "react-error-boundary";
import { CampusMapViewError } from "./campus-map-view-error.tsx";
import React, { Suspense } from "react";
import { CampusMapViewSkeleton } from "./campus-map-view-skeleton.tsx";

const CampusMapView = React.lazy(() => import('./campus-map-view.tsx'));

export const LazyCampusMapView = () => (
    <ErrorBoundary fallback={<CampusMapViewError/>}>
        <Suspense fallback={<CampusMapViewSkeleton/>}>
            <CampusMapView/>
        </Suspense>
    </ErrorBoundary>
);