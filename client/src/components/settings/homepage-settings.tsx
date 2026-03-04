import React from 'react';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { HomepageViewsSetting } from './homepage-views-setting.tsx';
import { ApplicationSettings, HomeSettings } from '../../constants/settings.ts';
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
                icon="recommend"
                name="Show Recommendations on Homepage"
                description="When enabled, the home page will show personalized recommendations and favorites."
                setting={ApplicationSettings.showRecommendationsOnHome}/>
            <BooleanSettingInput
                icon="restaurant_menu"
                name="Show Explore on Homepage"
                description="When enabled, the home page will show suggested searches for food on campus."
                setting={HomeSettings.showExploreOnHome}/>
            <BooleanSettingInput
                icon="comment"
                name="Show Recent Reviews on Homepage"
                description="When enabled, the home page will show some of the most recent reviews left for menu items."
                setting={HomeSettings.showRecentReviewsOnHome}/>
            <BooleanSettingInput
                icon="map"
                name="Show Map on Homepage"
                description="When enabled, the home page will show a map that lets you view nearby cafes and their traveling stations."
                setting={HomeSettings.showMapOnHome}/>
            {
                hasAnyHomepageViews && homepageViewsComponent
            }
        </SettingsGroup>
    );
};