import { SpecialSettings } from '../../../constants/settings.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import { HomeCollapse } from './home-collapse.tsx';
import { LazyCampusMapView } from "../../map/lazy-campus-map-view.tsx";

export const HomeMap = () => {
    const showMapOnHome = useValueNotifier(SpecialSettings.showMapOnHome);

    if (!showMapOnHome) {
        return null;
    }

    return (
        <HomeCollapse title="What's Nearby" featureToggle={SpecialSettings.showMapOnHome}>
            <LazyCampusMapView/>
        </HomeCollapse>
    );
}