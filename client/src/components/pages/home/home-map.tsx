import { HomeSettings, DebugSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { HomeCollapse } from './home-collapse.tsx';
import { LazyCampusMapView } from "../../map/lazy-campus-map-view.tsx";
import { useTitleWithSelectedDate } from "../../../hooks/string.ts";
import { CampusMapClickTip } from '../../map/campus-map-click-tip.js';
import { Link } from 'react-router-dom';

export const HomeMap = () => {
    const title = useTitleWithSelectedDate('What\'s Nearby');
    const showMapOnHome = useValueNotifier(HomeSettings.showMapOnHome);
    const isMapPageEnabled = useValueNotifier(DebugSettings.enableMapPage);

    if (!showMapOnHome) {
        return null;
    }

    return (
        <HomeCollapse title={title} featureToggle={HomeSettings.showMapOnHome}>
            <CampusMapClickTip/>
            <LazyCampusMapView/>
            {isMapPageEnabled && (
                <Link to="/map" className="default-button flex flex-center default-container">
                    <span className="material-symbols-outlined">open_in_full</span>
                    <span>
                        Open Full Map
                    </span>
                </Link>
            )}
        </HomeCollapse>
    );
}