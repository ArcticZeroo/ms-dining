import React, { Suspense } from 'react';
import { CampusMapViewSkeleton } from '../../map/campus-map-view-skeleton.tsx';

const CampusMapView = React.lazy(() => import('../../map/campus-map-view.tsx'));

export const MapTestPage = () => {
    return (
        <div className="map-height">
            <Suspense fallback={<CampusMapViewSkeleton/>}>
                <CampusMapView/>
            </Suspense>
        </div>
    );
}