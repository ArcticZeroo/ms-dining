import { HomeSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { HomeCollapse } from './home-collapse.tsx';
import { LazyCampusMapView } from "../../map/lazy-campus-map-view.tsx";
import { useTitleWithSelectedDate } from "../../../hooks/string.ts";
import { CampusMapClickTip } from '../../map/campus-map-click-tip.js';

export const HomeMap = () => {
    const title = useTitleWithSelectedDate('What\'s Nearby');
    const showMapOnHome = useValueNotifier(HomeSettings.showMapOnHome);

    if (!showMapOnHome) {
        return null;
    }

    return (
        <HomeCollapse title={title} featureToggle={HomeSettings.showMapOnHome}>
            <CampusMapClickTip/>
            <LazyCampusMapView/>
        </HomeCollapse>
    );
}