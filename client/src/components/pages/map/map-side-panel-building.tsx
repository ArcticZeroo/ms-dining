import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IBuildingInfo } from '@msdining/common/models/building';
import { useNearestCafes } from '../../../hooks/nearby-cafes.ts';
import { MapSidePanelContainer } from './map-side-panel-container.tsx';
import { NearbyCafesList } from './nearby-cafes-list.tsx';

interface IMapSidePanelBuildingProps {
    building: IBuildingInfo;
}

export const MapSidePanelBuilding: React.FC<IMapSidePanelBuildingProps> = ({ building }) => {
    const navigate = useNavigate();
    const nearestCafes = useNearestCafes(building.centroid);

    return (
        <MapSidePanelContainer>
            <div className="panel-header flex">
                <span className="material-symbols-outlined">apartment</span>
                <span className="panel-title">{building.name}</span>
                <button
                    onClick={() => navigate('/map')}
                    className="default-button default-container icon-container"
                    title="Close"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            <div className="panel-content flex-col">
                <NearbyCafesList nearestCafes={nearestCafes}/>
            </div>
        </MapSidePanelContainer>
    );
};
