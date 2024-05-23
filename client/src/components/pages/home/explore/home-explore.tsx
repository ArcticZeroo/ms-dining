import { SearchIdeas } from './search-ideas.tsx';
import { useValueNotifier } from '../../../../hooks/events.ts';
import { SpecialSettings } from '../../../../constants/settings.ts';

export const HomeExplore = () => {
    const showExploreOnHome = useValueNotifier(SpecialSettings.showExploreOnHome);

    if (!showExploreOnHome) {
        return;
    }

    return (
        <div className="flex-col default-container">
            <div className="default-container" id="explore-header">
				Explore food on campus
            </div>
            <SearchIdeas/>
        </div>
    );
};