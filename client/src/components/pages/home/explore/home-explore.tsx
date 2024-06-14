import { SearchIdeas } from './search-ideas.tsx';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { HomeSettings } from '../../../../constants/settings.ts';
import { HomeCollapse } from '../home-collapse.tsx';
import { useTitleWithSelectedDate } from "../../../../hooks/string.ts";

export const HomeExplore = () => {
    const title = useTitleWithSelectedDate('Explore Food on Campus');
    const showExploreOnHome = useValueNotifier(HomeSettings.showExploreOnHome);

    if (!showExploreOnHome) {
        return;
    }

    return (
        <HomeCollapse title={title} featureToggle={HomeSettings.showExploreOnHome}>
            <SearchIdeas/>
        </HomeCollapse>
    );
};