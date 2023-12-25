import { ApplicationSettings } from '../../../api/settings.ts';
import { useDatePicker } from '../../../hooks/date-picker.tsx';
import { useValueNotifier } from '../../../hooks/events.ts';
import { HomepageSettings } from '../../settings/homepage-settings.tsx';
import { HomeFavorites } from './favorites/home-favorites.tsx';
import { HomeViews } from './home-views.tsx';

import './home.css';

export const HomePage = () => {
    const shouldShowFavorites = useValueNotifier(ApplicationSettings.showFavoritesOnHome);
    const datePicker = useDatePicker();

    return (
        <>
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