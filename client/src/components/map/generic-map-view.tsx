import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet/dist/leaflet.css';
import './map.css';

import { useVisibleViewsForNav } from '../../hooks/views.js';
import React, { useContext, useMemo } from 'react';
import { ApplicationContext } from '../../context/app.js';
import { toLeafletLocation } from '../../util/coordinates.js';
import { getMapCenter } from '../../util/map.js';
import { MapContainer, TileLayer } from 'react-leaflet';
import { DEFAULT_MAP_ZOOM } from '../../constants/map.js';
import { CampusMapUserLocation } from './campus-map-user-location.js';
import { CampusMapControls } from './campus-map-controls.js';
import { classNames } from '../../util/react.js';

interface IGenericMapViewProps {
    children: React.ReactNode;
    popupContent?: React.ReactNode;
    isMapHeight: boolean;
}

export const GenericMapView: React.FC<IGenericMapViewProps> = ({ children, popupContent, isMapHeight }) => {
    const views = useVisibleViewsForNav(true /*shouldUseGroups*/);
    const { viewsById } = useContext(ApplicationContext);
    const center = useMemo(
        () => toLeafletLocation(getMapCenter(views, viewsById)),
        [views, viewsById]
    );

    return (
        <div className={classNames('campus-map-container', isMapHeight && 'map-height')}>
            <MapContainer
                center={center}
                zoom={DEFAULT_MAP_ZOOM}
                scrollWheelZoom={true}
                className="campus-map"
            >
                <CampusMapUserLocation/>
                <CampusMapControls center={center}/>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {children}
            </MapContainer>
            {popupContent}
        </div>
    );
}