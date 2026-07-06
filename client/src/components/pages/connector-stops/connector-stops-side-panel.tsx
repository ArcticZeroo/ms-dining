import React from 'react';
import { IConnectorStopsState } from '../../../hooks/connector-stops.ts';
import { CollapsibleBody } from '../../collapsible/collapsible-body.js';
import { CollapsibleContainer } from '../../collapsible/collapsible-container.js';
import { CollapsibleHeader } from '../../collapsible/collapsible-header.js';
import { StopListItem } from './connector-stop-list-item.tsx';

interface IConnectorStopsSidePanelProps {
    connectorStops: IConnectorStopsState;
}

export const ConnectorStopsSidePanel: React.FC<IConnectorStopsSidePanelProps> = ({ connectorStops }) => {
    const {
        filteredStops,
        groupedStops,
        isSearching,
        onSearchQueryChanged,
        onStopClicked,
        onStopHoverEnded,
        onStopHoverStarted,
        searchQuery,
        selectedStop,
    } = connectorStops;

    return (
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
                    onChange={onSearchQueryChanged}
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
                                            onMouseEnter={() => onStopHoverStarted(stop)}
                                            onMouseLeave={onStopHoverEnded}
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
    );
};
