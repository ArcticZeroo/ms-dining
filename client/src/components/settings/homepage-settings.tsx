import React from 'react';
import { ApplicationSettings } from '../../api/settings.ts';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { HomepageViewsSetting } from './homepage-views-setting.tsx';

interface IHomepageSettingsProps {
	requireButtonToCommitHomepageViews: boolean;
}

export const HomepageSettings: React.FC<IHomepageSettingsProps> = ({ requireButtonToCommitHomepageViews }) => (
    <div className="card settings-group">
        <div className="title">
			Homepage Setup
        </div>
        <BooleanSettingInput
            icon="star"
            name="Show Favorites on Homepage"
            description="When enabled, the home page will search for items that are in your favorites list."
            setting={ApplicationSettings.showFavoritesOnHome}/>
        <HomepageViewsSetting requireButtonToCommit={requireButtonToCommitHomepageViews}/>
    </div>
);