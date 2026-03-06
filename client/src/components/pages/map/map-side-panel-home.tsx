import { MapSidePanelContainer } from './map-side-panel-container.tsx';

export const MapSidePanelHome = () => {
    return (
        <MapSidePanelContainer>
            <div className="panel-header flex">
                <span className="material-symbols-outlined">map</span>
                <span className="panel-title">Campus Map</span>
            </div>
            <div className="panel-content flex-col">
                <span className="subtitle">
                    Click on a cafe marker to see details.
                </span>
                <span className="subtitle">
                    Use the search bar to find specific cafes, menu items, or stations.
                </span>
            </div>
        </MapSidePanelContainer>
    );
};
