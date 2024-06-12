import React, { Suspense } from 'react';
import { SpecialSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { CampusMapViewSkeleton } from '../../map/campus-map-view-skeleton.tsx';
import { HomeCollapse } from './home-collapse.tsx';

const CampusMapView = React.lazy(() => import('../../map/campus-map-view.tsx'));

export const HomeMap = () => {
    const showMapOnHome = useValueNotifier(SpecialSettings.showMapOnHome);

    if (!showMapOnHome) {
        return null;
    }

    return (
        <HomeCollapse title="What's Nearby">
            <Suspense fallback={<CampusMapViewSkeleton/>}>
                <CampusMapView/>
            </Suspense>
        </HomeCollapse>
    );
}