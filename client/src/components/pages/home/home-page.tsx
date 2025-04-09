import { ApplicationSettings } from '../../../constants/settings.ts';
import { useDatePicker } from '../../../hooks/date-picker.tsx';
import { useValueNotifier } from '../../../hooks/events.ts';
import { MoreSettingsButton } from '../../button/more-settings-button.tsx';
import { HomepageSettings } from '../../settings/homepage-settings.tsx';
import { HomeExplore } from './explore/home-explore.tsx';
import { HomeFavorites } from './favorites/home-favorites.tsx';
import { HomeMap } from './home-map.tsx';
import { HomeViews } from './home-views.tsx';
import { HomeWelcomeMessage } from './home-welcome-message.tsx';

import './home.css';
import { usePageData } from '../../../hooks/location.ts';
import { HomeRecentReviews } from './reviews/home-recent-reviews.tsx';

const useShouldShowWelcomeMessage = () => {
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);

    return homepageViewIds.size === 0 && favoriteItemNames.size === 0;
};

export const HomePage = () => {
    const datePicker = useDatePicker();
    const isNewUser = useShouldShowWelcomeMessage();

    usePageData('Home', 'View the home page - a customizable dashboard for your favorite items and cafes.');

    return (
        <>
            {
                isNewUser && (
                    <HomeWelcomeMessage/>
                )
            }
            {
                datePicker
            }
            <HomeFavorites/>
            <HomeMap/>
            <HomeExplore/>
            <HomeRecentReviews/>
            <HomeViews/>
            <HomepageSettings requireButtonToCommitHomepageViews={true}/>
            <MoreSettingsButton/>
        </>
    );
};