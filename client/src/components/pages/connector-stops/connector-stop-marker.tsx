import L from 'leaflet';
import React from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import { IConnectorStop } from '@msdining/common/constants/connector-stops';

const createIcon = (isHighlighted: boolean) => L.divIcon({
    html: `
<div class="cafe-marker-container connector-stop-marker${isHighlighted ? ' is-highlighted' : ''}">
    <div class="cafe-marker-tracker flex flex-center">
        🚌
    </div>
</div>
`
});

const defaultIcon = createIcon(false);
const highlightedIcon = createIcon(true);

interface IConnectorStopMarkerProps {
    stop: IConnectorStop;
    isHighlighted?: boolean;
}

export const ConnectorStopMarker: React.FC<IConnectorStopMarkerProps> = ({ stop, isHighlighted = false }) => {
    return (
        <Marker
            position={{ lat: stop.lat, lng: stop.lng }}
            icon={isHighlighted ? highlightedIcon : defaultIcon}
            zIndexOffset={isHighlighted ? 1000 : 0}
        >
            <Tooltip direction="top" offset={[0, -10]}>
                {stop.name}
            </Tooltip>
            <Popup>
                <div className="flex-col" style={{ gap: '0.25rem' }}>
                    <b>{stop.name}</b>
                    <div className="flex" style={{ gap: '0.25rem', flexWrap: 'wrap' }}>
                        {stop.route && <span className="chip" style={{ background: '#107C10', color: '#fff', fontSize: '0.7rem', padding: '0.125rem 0.375rem' }}>{stop.route}</span>}
                        {stop.hasParking && <span className="chip" style={{ background: '#8661C5', color: '#fff', fontSize: '0.7rem', padding: '0.125rem 0.375rem' }}>Parking</span>}
                    </div>
                    {stop.address && stop.address !== stop.name && (
                        <span style={{ fontSize: '0.85em' }}>
                            {stop.address}{stop.city ? `, ${stop.city}` : ''}
                        </span>
                    )}
                    {stop.description && (
                        <div style={{ fontSize: '0.85em', whiteSpace: 'pre-line', maxHeight: '8rem', overflowY: 'auto' }}>
                            {stop.description}
                        </div>
                    )}
                    <div style={{ fontSize: '0.8em' }}>
                        <a href={`https://www.bing.com/maps?q=${stop.lat},${stop.lng}`} target="_blank" rel="noopener">Bing Maps</a>
                        {' · '}
                        <a href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`} target="_blank" rel="noopener">Google Maps</a>
                    </div>
                </div>
            </Popup>
        </Marker>
    );
};
