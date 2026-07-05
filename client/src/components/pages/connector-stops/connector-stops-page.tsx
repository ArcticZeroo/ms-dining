import { useCallback, useMemo, useState } from 'react';
import { useMap } from 'react-leaflet';
import { usePageData } from '../../../hooks/location.js';
import { GenericMapView } from '../../map/generic-map-view.js';
import { BuildingOutlineLayer } from '../../map/building-outline-layer.js';
import { ConnectorStopMarker } from './connector-stop-marker.js';
import { StopListItem } from './connector-stop-list-item.tsx';
import { CONNECTOR_STOPS, IConnectorStop } from '@msdining/common/constants/connector-stops';
import { CollapsibleContainer } from '../../collapsible/collapsible-container.js';
import { CollapsibleHeader } from '../../collapsible/collapsible-header.js';
import { CollapsibleBody } from '../../collapsible/collapsible-body.js';
import './connector-stops-page.css';

const SEATTLE_CENTER = { lat: 47.62, lng: -122.20 };
const INITIAL_ZOOM = 10;
const FLY_TO_ZOOM = 16;

const noopBuilding = () => {};
const noopBuildingNullable = () => {};

interface IFlyToStopProps {
    stop: IConnectorStop | null;
}

const FlyToStop: React.FC<IFlyToStopProps> = ({ stop }) => {
    const map = useMap();

    if (stop) {
        map.flyTo({ lat: stop.lat, lng: stop.lng }, FLY_TO_ZOOM, { duration: 0.5 });
    }

    return null;
};

interface IStopGroup {
    area: string;
    stops: IConnectorStop[];
}

const groupStopsByArea = (stops: IConnectorStop[]): IStopGroup[] => {
    const groups = new Map<string, IConnectorStop[]>();
    for (const stop of stops) {
        const existing = groups.get(stop.area);
        if (existing) {
            existing.push(stop);
        } else {
            groups.set(stop.area, [stop]);
        }
    }
    return Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([area, stops]) => ({ area, stops }));
};

// eslint-disable-next-line react/no-multi-comp -- FlyToStop is a tiny co-located map fly-to effect used only here
export const ConnectorStopsPage = () => {
    usePageData('Connector Stops', 'View Microsoft Connector shuttle bus stops around the Seattle area.');

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStop, setSelectedStop] = useState<IConnectorStop | null>(null);
    const [flyTarget, setFlyTarget] = useState<IConnectorStop | null>(null);
    const [hoveredStop, setHoveredStop] = useState<IConnectorStop | null>(null);

    const filteredStops = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return CONNECTOR_STOPS;
        }
        return CONNECTOR_STOPS.filter(
            stop => stop.name.toLowerCase().includes(query)
                || stop.route.toLowerCase().includes(query)
                || stop.address.toLowerCase().includes(query)
                || stop.area.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    const groupedStops = useMemo(() => groupStopsByArea(filteredStops), [filteredStops]);

    const onStopClicked = useCallback((stop: IConnectorStop) => {
        setSelectedStop(prev => prev === stop ? null : stop);
        setFlyTarget(stop);
    }, []);

    const isSearching = searchQuery.trim().length > 0;

    return (
        <div className="connector-stops-page full-page-map">
            <div className="map-side-panel flex-col">
                <div className="panel-header flex-col">
                    <div className="flex">
                        <span className="material-symbols-outlined">directions_bus</span>
                        <span className="panel-title">Connector Stops</span>
                    </div>
                    <input
                        type="text"
                        className="connector-stops-panel-search"
                        placeholder="Search name, route, or area…"
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                    />
                </div>
                <div className="panel-content flex-col">
                    <span className="subtitle map-search-result-count">
                        {filteredStops.length} stops
                    </span>
                    {groupedStops.map(group => (
                        <CollapsibleContainer key={group.area} isExpandedByDefault={isSearching}>
                            <div className="connector-stops-area-group">
                                <CollapsibleHeader>
                                    <span className="connector-stops-area-name">
                                        {group.area}
                                        <span className="subtitle"> ({group.stops.length})</span>
                                    </span>
                                </CollapsibleHeader>
                                <CollapsibleBody>
                                    <div className="map-search-results-list flex-col">
                                        {group.stops.map(stop => (
                                            <StopListItem
                                                key={stop.id}
                                                stop={stop}
                                                isSelected={selectedStop === stop}
                                                onClick={() => onStopClicked(stop)}
                                                onMouseEnter={() => setHoveredStop(stop)}
                                                onMouseLeave={() => setHoveredStop(null)}
                                            />
                                        ))}
                                    </div>
                                </CollapsibleBody>
                            </div>
                        </CollapsibleContainer>
                    ))}
                </div>
                <div className="panel-footer">
                    <div className="card yellow horizontal connector-stops-disclaimer">
                        <span className="material-symbols-outlined">warning</span>
                        <span>Data from May 2026 — may be out of date.</span>
                    </div>
                </div>
            </div>
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
        </div>
    );
};
