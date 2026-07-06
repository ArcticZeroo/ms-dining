import React from 'react';
import { IConnectorStopsState } from '../../../hooks/connector-stops.ts';
import { BuildingOutlineLayer } from '../../map/building-outline-layer.js';
import { GenericMapView } from '../../map/generic-map-view.js';
import { ConnectorStopMarker } from './connector-stop-marker.js';
import { FlyToStop } from './fly-to-stop.tsx';

const SEATTLE_CENTER = { lat: 47.62, lng: -122.20 };
const INITIAL_ZOOM = 10;

const noopBuilding = () => {};
const noopBuildingNullable = () => {};

interface IConnectorStopsMapAreaProps {
    connectorStops: IConnectorStopsState;
}

export const ConnectorStopsMapArea: React.FC<IConnectorStopsMapAreaProps> = ({ connectorStops }) => {
    const { filteredStops, flyTarget, hoveredStop } = connectorStops;

    return (
        <div className="map-area">
            <GenericMapView center={SEATTLE_CENTER} zoom={INITIAL_ZOOM} isMapHeight={false}>
                <FlyToStop stop={flyTarget}/>
                <BuildingOutlineLayer
                    highlightedBuildingName={null}
                    onBuildingClick={noopBuilding}
                    onBuildingHover={noopBuildingNullable}
                    uniformStyle
                    showCampusMarker
                />
                {filteredStops.map(stop => (
                    <ConnectorStopMarker key={stop.id} stop={stop} isHighlighted={hoveredStop === stop}/>
                ))}
            </GenericMapView>
        </div>
    );
};
