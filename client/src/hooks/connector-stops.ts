import { CONNECTOR_STOPS, IConnectorStop } from '@msdining/common/constants/connector-stops';
import type { ChangeEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

export interface IConnectorStopGroup {
    area: string;
    stops: IConnectorStop[];
}

export interface IConnectorStopsState {
    filteredStops: IConnectorStop[];
    flyTarget: IConnectorStop | null;
    groupedStops: IConnectorStopGroup[];
    hoveredStop: IConnectorStop | null;
    isSearching: boolean;
    onSearchQueryChanged(event: ChangeEvent<HTMLInputElement>): void;
    onStopClicked(stop: IConnectorStop): void;
    onStopHoverEnded(): void;
    onStopHoverStarted(stop: IConnectorStop): void;
    searchQuery: string;
    selectedStop: IConnectorStop | null;
}

export const groupStopsByArea = (stops: IConnectorStop[]): IConnectorStopGroup[] => {
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
        .sort(([areaA], [areaB]) => areaA.localeCompare(areaB))
        .map(([area, stops]) => ({ area, stops }));
};

const connectorStopMatchesQuery = (stop: IConnectorStop, query: string) => (
    stop.name.toLowerCase().includes(query)
    || stop.route.toLowerCase().includes(query)
    || stop.address.toLowerCase().includes(query)
    || stop.area.toLowerCase().includes(query)
);

export const useConnectorStops = (): IConnectorStopsState => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStop, setSelectedStop] = useState<IConnectorStop | null>(null);
    const [flyTarget, setFlyTarget] = useState<IConnectorStop | null>(null);
    const [hoveredStop, setHoveredStop] = useState<IConnectorStop | null>(null);

    const filteredStops = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return CONNECTOR_STOPS;
        }
        return CONNECTOR_STOPS.filter(stop => connectorStopMatchesQuery(stop, query));
    }, [searchQuery]);

    const groupedStops = useMemo(() => groupStopsByArea(filteredStops), [filteredStops]);

    const onSearchQueryChanged = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(event.target.value);
    }, []);

    const onStopClicked = useCallback((stop: IConnectorStop) => {
        setSelectedStop(prev => prev === stop ? null : stop);
        setFlyTarget(stop);
    }, []);

    const onStopHoverEnded = useCallback(() => {
        setHoveredStop(null);
    }, []);

    const onStopHoverStarted = useCallback((stop: IConnectorStop) => {
        setHoveredStop(stop);
    }, []);

    const isSearching = searchQuery.trim().length > 0;

    return {
        filteredStops,
        flyTarget,
        groupedStops,
        hoveredStop,
        isSearching,
        onSearchQueryChanged,
        onStopClicked,
        onStopHoverEnded,
        onStopHoverStarted,
        searchQuery,
        selectedStop,
    };
};
