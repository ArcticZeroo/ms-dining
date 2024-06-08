import { ApplicationSettings } from '../../constants/settings.ts';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { CustomKeySetting } from './custom-key-setting.tsx';
import { LocationSetting } from './location-setting.tsx';
import { SettingsGroup } from './settings-group.tsx';

export const OtherSettings = () => (
    <SettingsGroup title="Other Settings" iconName="settings">
        <LocationSetting/>
        <BooleanSettingInput
            icon="group"
            setting={ApplicationSettings.shouldUseGroups}
            name="Group Cafes"
            description="When enabled, cafes in the nav and search will be grouped by location."
        />
        <BooleanSettingInput
            icon="view_compact"
            setting={ApplicationSettings.shouldUseCompactMode}
            name="Enable Compact View Mode"
            description="When enabled, padding & text will be smaller and some elements will be condensed."
        />
        <BooleanSettingInput
            icon="tag"
            setting={ApplicationSettings.shouldCondenseNumbers}
            name="Condense Numbered Cafes"
            description="When enabled, numbered cafes are condensed into tiles in the navigation menu."
        />
        <BooleanSettingInput
            icon="bookmark"
            setting={ApplicationSettings.showSearchTags}
            name="Show Search Tags"
            description="When enabled, AI-generated tags like 'beverage' may appear next to search results."
        />
        <CustomKeySetting/>
    </SettingsGroup>
)