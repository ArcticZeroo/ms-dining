import React from 'react';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { HomepageViewsSetting } from './homepage-views-setting.tsx';
import { ApplicationSettings } from '../../constants/settings.ts';
import { useValueNotifier } from '../../hooks/events.ts';

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
        <div className="card settings-group">
            <div className="title">
                Homepage Setup
            </div>
            {
                !hasAnyHomepageViews && homepageViewsComponent
            }
            <BooleanSettingInput
                icon="star"
                name="Show Favorites on Homepage"
                description="When enabled, the home page will search for items that are in your favorites list."
                setting={ApplicationSettings.showFavoritesOnHome}/>
            {
                hasAnyHomepageViews && homepageViewsComponent
            }
        </div>
    );
};