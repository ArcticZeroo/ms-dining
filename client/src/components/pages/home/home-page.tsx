import { HomeViews } from './home-views.tsx';

import './home.css';
import { HomeFavorites } from './favorites/home-favorites.tsx';
import { BooleanSettingInput } from '../settings/boolean-setting-input.tsx';
import { ApplicationSettings } from '../../../api/settings.ts';
import { HomepageViewsSetting } from '../settings/homepage-views-setting.tsx';
import { useValueNotifier } from '../../../hooks/events.ts';

export const HomePage = () => {
    const shouldShowFavorites = useValueNotifier(ApplicationSettings.showFavoritesOnHome);

    return (
        <>
            {
                shouldShowFavorites && (
                    <HomeFavorites/>
                )
            }
            <HomeViews/>
            <div className="card centered">
                <div className="title">
                    Homepage Setup
                </div>
                <BooleanSettingInput
                    icon="star"
                    name="Show Favorites on Homepage"
                    description="When enabled, the home page will search for items that are in your favorites list."
                    setting={ApplicationSettings.showFavoritesOnHome}/>
                <HomepageViewsSetting requireButtonToCommit={true}/>
            </div>
        </>
    );
};