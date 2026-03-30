import { useSearchParams } from 'react-router-dom';
import { MapSidePanelHome } from './map-side-panel-home.tsx';
import { MapSidePanelOverview } from './map-side-panel-overview.tsx';
import { MapSidePanelSearch } from './map-side-panel-search.tsx';
import { MapSidePanelBuilding } from './map-side-panel-building.tsx';
import { useMapPageOverviewSelectedView, useMapPageSelectedBuilding } from '../../../hooks/map.js';

export const MapSidePanel = () => {
    const overviewSelectedView = useMapPageOverviewSelectedView();
    const selectedBuilding = useMapPageSelectedBuilding();
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') ?? '';

    if (selectedBuilding) {
        return <MapSidePanelBuilding building={selectedBuilding}/>;
    }

    if (overviewSelectedView) {
        return <MapSidePanelOverview view={overviewSelectedView}/>;
    }

    if (query.length > 0) {
        return <MapSidePanelSearch/>;
    }

    return <MapSidePanelHome/>;
};
