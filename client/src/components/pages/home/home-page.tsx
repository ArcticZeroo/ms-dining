import { useEffect } from 'react';
import { ApplicationSettings } from '../../../constants/settings.ts';
import { useDatePicker } from '../../../hooks/date-picker.tsx';
import { useValueNotifier } from '../../../hooks/events.ts';
import { setPageData } from '../../../util/title.ts';
import { MoreSettingsButton } from '../../button/more-settings-button.tsx';
import { HomepageSettings } from '../../settings/homepage-settings.tsx';
import { HomeExplore } from './explore/home-explore.tsx';
import { HomeFavorites } from './favorites/home-favorites.tsx';
import { HomeViews } from './home-views.tsx';
import { HomeWelcomeMessage } from './home-welcome-message.tsx';

import './home.css';

// const CampusMapView = React.lazy(() => import('../../map/campus-map-view.tsx'));

const useShouldShowWelcomeMessage = () => {
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const favoriteItemNames = useValueNotifier(ApplicationSettings.favoriteItemNames);

    return homepageViewIds.size === 0 && favoriteItemNames.size === 0;
}

export const HomePage = () => {
    const shouldShowFavorites = useValueNotifier(ApplicationSettings.showFavoritesOnHome);
    const datePicker = useDatePicker();
    const isNewUser = useShouldShowWelcomeMessage();

    useEffect(() => {
        setPageData('Home', 'View the home page - a customizable dashboard for your favorite items and cafes.');
    }, []);

    return (
        <>
            {
                isNewUser && (
                    <>
                        <HomeWelcomeMessage/>
                    </>
                )
            }
            {
                datePicker
            }
            {
                shouldShowFavorites && (
                    <HomeFavorites/>
                )
            }
            <HomeExplore/>
            {/*
            <div className="map-height">
                <Suspense fallback="Loading map...">
                    <CampusMapView/>
                </Suspense>
            </div>
            */}
            <HomeViews/>
            <HomepageSettings requireButtonToCommitHomepageViews={true}/>
            <MoreSettingsButton/>
        </>
    );
};