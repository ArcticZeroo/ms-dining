import { useVisibleViewsForNav } from '../../hooks/views.js';
import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../context/app.js';
import { toLeafletLocation } from '../../util/coordinates.js';
import { getMapCenter } from '../../util/map.js';
import { DEFAULT_MAP_ZOOM } from '../../constants/map.js';
import { GenericMapView } from './generic-map-view.js';

interface IGenericCafeMapViewProps {
    children: React.ReactNode;
    popupContent?: React.ReactNode;
    isMapHeight: boolean;
}

export const GenericCafeMapView: React.FC<IGenericCafeMapViewProps> = ({ children, popupContent, isMapHeight }) => {
    const views = useVisibleViewsForNav(true /*shouldUseGroups*/);
    const { viewsById } = useContext(ApplicationContext);
    const center = useMemo(
        () => toLeafletLocation(getMapCenter(views, viewsById)),
        [views, viewsById]
    );

    return (
        <GenericMapView center={center} zoom={DEFAULT_MAP_ZOOM} popupContent={popupContent} isMapHeight={isMapHeight}>
            {children}
        </GenericMapView>
    );
};
