import { SearchIdeas } from './search-ideas.tsx';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { SpecialSettings } from '../../../../constants/settings.ts';
import { HomeCollapse } from '../home-collapse.tsx';

export const HomeExplore = () => {
    const showExploreOnHome = useValueNotifier(SpecialSettings.showExploreOnHome);

    if (!showExploreOnHome) {
        return;
    }

    return (
        <HomeCollapse title="Explore food on campus">
            <SearchIdeas/>
        </HomeCollapse>
    );
};