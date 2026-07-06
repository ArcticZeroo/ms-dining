import { IConnectorStop } from '@msdining/common/constants/connector-stops';
import React from 'react';
import { useMap } from 'react-leaflet';

const FLY_TO_ZOOM = 16;

interface IFlyToStopProps {
    stop: IConnectorStop | null;
}

export const FlyToStop: React.FC<IFlyToStopProps> = ({ stop }) => {
    const map = useMap();

    if (stop) {
        map.flyTo({ lat: stop.lat, lng: stop.lng }, FLY_TO_ZOOM, { duration: 0.5 });
    }

    return null;
};
