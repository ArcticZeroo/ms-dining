import { useEffect } from 'react';
import { setPageData } from '../../../util/title.ts';
import { BooleanSettingInput } from '../../settings/boolean-setting-input.tsx';
import { CustomKeySetting } from '../../settings/custom-key-setting.tsx';
import { HomepageSettings } from '../../settings/homepage-settings.tsx';
import { MenuSettings } from '../../settings/menu-settings.tsx';
import './settings.css';
import { LocationSetting } from '../../settings/location-setting.tsx';
import { ApplicationSettings } from '../../../constants/settings.ts';

export const SettingsPage = () => {
    useEffect(() => {
        setPageData('Settings', 'Customize your settings for the app');
    }, []);

    return (
        <div id="settings">
            <HomepageSettings requireButtonToCommitHomepageViews={false}/>
            <MenuSettings/>
            <div className="card settings-group">
                <div className="title">
                    Other Settings
                </div>
                <div className="body">
                    <BooleanSettingInput
                        icon="group"
                        setting={ApplicationSettings.shouldUseGroups}
                        name="Group Cafes"
                        description="When enabled, cafes in the nav and search will be grouped by location."
                    />
                    <BooleanSettingInput
                        icon="tag"
                        setting={ApplicationSettings.shouldCondenseNumbers}
                        name="Condense Numbered Cafes"
                        description="When enabled, numbered cafes are condensed into tiles in the navigation menu."
                    />
                    <LocationSetting/>
                    <CustomKeySetting/>
                </div>
            </div>
        </div>
    );
};