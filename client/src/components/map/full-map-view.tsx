import React from 'react';
import { GenericCafeMapView } from './generic-cafe-map-view.js';
import { MapBuildings } from '../pages/map/map-buildings.js';
import { FullMapMarkers, IFullMapMarkersProps } from './full-map-markers.tsx';

const FullMapView: React.FC<IFullMapMarkersProps> = (props) => {
    return (
        <GenericCafeMapView isMapHeight={false}>
            <MapBuildings/>
            <FullMapMarkers {...props}/>
        </GenericCafeMapView>
    );
};

export default FullMapView;