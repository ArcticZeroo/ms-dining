import { SearchIdeas } from './search-ideas.tsx';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { SpecialSettings } from '../../../../constants/settings.ts';
import { HomeCollapse } from '../home-collapse.tsx';
import { useTitleWithSelectedDate } from "../../../../hooks/string.ts";

export const HomeExplore = () => {
    const title = useTitleWithSelectedDate('Explore Food on Campus');
    const showExploreOnHome = useValueNotifier(SpecialSettings.showExploreOnHome);

    if (!showExploreOnHome) {
        return;
    }

    return (
        <HomeCollapse title={title} featureToggle={SpecialSettings.showExploreOnHome}>
            <SearchIdeas/>
        </HomeCollapse>
    );
};