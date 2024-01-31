import { ApplicationSettings } from '../../../api/settings.ts';
import { useDatePicker } from '../../../hooks/date-picker.tsx';
import { useValueNotifier } from '../../../hooks/events.ts';
import { HomepageSettings } from '../../settings/homepage-settings.tsx';
import { HomeFavorites } from './favorites/home-favorites.tsx';
import { HomeViews } from './home-views.tsx';

import './home.css';
import { useEffect } from 'react';
import { setPageSubtitle } from '../../../util/title.ts';
import { HomeWelcomeMessage } from './home-welcome-message.tsx';

const useShouldShowWelcomeMessage = () => {
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);

    return homepageViewIds.size === 0 && favoriteItemNames.size === 0;
}

export const HomePage = () => {
    const shouldShowFavorites = useValueNotifier(ApplicationSettings.showFavoritesOnHome);
    const datePicker = useDatePicker();
    const shouldShowWelcomeMessage = useShouldShowWelcomeMessage();

    useEffect(() => {
        setPageSubtitle('Home');
    }, []);

    return (
        <>
            {
                shouldShowWelcomeMessage && <HomeWelcomeMessage/>
            }
            {
                datePicker
            }
            {
                shouldShowFavorites && (
                    <HomeFavorites/>
                )
            }
            <HomeViews/>
            <HomepageSettings requireButtonToCommitHomepageViews={true}/>
        </>
    );
};