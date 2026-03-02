import { useParams, useSearchParams } from 'react-router-dom';
import { MapSidePanelHome } from './map-side-panel-home.tsx';
import { MapSidePanelOverview } from './map-side-panel-overview.tsx';
import { MapSidePanelSearch } from './map-side-panel-search.tsx';

export const MapSidePanel = () => {
    const { viewId } = useParams<{ viewId: string }>();
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') ?? '';

    if (viewId) {
        return <MapSidePanelOverview/>;
    }

    if (query.length > 0) {
        return <MapSidePanelSearch/>;
    }

    return <MapSidePanelHome/>;
};
