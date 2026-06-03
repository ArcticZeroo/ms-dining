import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet/dist/leaflet.css';
import './map.css';

import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { CampusMapUserLocation } from './campus-map-user-location.js';
import { CampusMapControls } from './campus-map-controls.js';
import { classNames } from '../../util/react.js';
import { ILeafletLocation } from '../../util/coordinates.js';

interface IGenericMapViewProps {
    center: ILeafletLocation;
    zoom: number;
    children: React.ReactNode;
    popupContent?: React.ReactNode;
    isMapHeight: boolean;
}

export const GenericMapView: React.FC<IGenericMapViewProps> = ({ center, zoom, children, popupContent, isMapHeight }) => {
    return (
        <div className={classNames('campus-map-container', isMapHeight && 'map-height')}>
            <MapContainer
                center={center}
                zoom={zoom}
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