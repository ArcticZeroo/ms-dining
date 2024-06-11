import React from 'react';

const CampusMapView = React.lazy(() => import('../../map/campus-map-view.tsx'));

export const MapTestPage = () => {
    return (
        <div style={{ height: '300px' }}>
            <CampusMapView/>
        </div>
    );
}