import { usePageData } from '../../../hooks/location.js';
import { useConnectorStops } from '../../../hooks/connector-stops.ts';
import { ConnectorStopsMapArea } from './connector-stops-map-area.tsx';
import { ConnectorStopsSidePanel } from './connector-stops-side-panel.tsx';
import './connector-stops-page.css';

export const ConnectorStopsPage = () => {
    usePageData('Connector Stops', 'View Microsoft Connector shuttle bus stops around the Seattle area.');

    const connectorStops = useConnectorStops();

    return (
        <div className="connector-stops-page full-page-map">
            <ConnectorStopsSidePanel connectorStops={connectorStops}/>
            <ConnectorStopsMapArea connectorStops={connectorStops}/>
        </div>
    );
};
