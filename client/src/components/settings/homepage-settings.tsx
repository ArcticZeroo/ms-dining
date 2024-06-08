import React from 'react';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { HomepageViewsSetting } from './homepage-views-setting.tsx';
import { ApplicationSettings, SpecialSettings } from '../../constants/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';
import { SettingsGroup } from './settings-group.tsx';

interface IHomepageSettingsProps {
	requireButtonToCommitHomepageViews: boolean;
}

export const HomepageSettings: React.FC<IHomepageSettingsProps> = ({ requireButtonToCommitHomepageViews }) => {
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);
    const hasAnyHomepageViews = homepageViewIds.size > 0;

    const homepageViewsComponent = (
        <HomepageViewsSetting requireButtonToCommit={requireButtonToCommitHomepageViews}/>
    );

    return (
        <SettingsGroup title="Homepage Setup" iconName="home">
            {
                !hasAnyHomepageViews && homepageViewsComponent
            }
            <BooleanSettingInput
                icon="star"
                name="Show Favorites on Homepage"
                description="When enabled, the home page will search for items that are in your favorites list."
                setting={ApplicationSettings.showFavoritesOnHome}/>
            <BooleanSettingInput
                icon="restaurant_menu"
                name="Show Explore on Homepage"
                description="When enabled, the home page will show suggested searches for food on campus."
                setting={SpecialSettings.showExploreOnHome}/>
            {
                hasAnyHomepageViews && homepageViewsComponent
            }
        </SettingsGroup>
    );
};