import { ApplicationSettings } from '../../constants/settings.ts';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { SettingsGroup } from './settings-group.tsx';

export const SearchSettings = () => (
    <SettingsGroup title="Search Settings" iconName="search">
        <BooleanSettingInput
            icon="attach_money"
            setting={ApplicationSettings.showPriceInSearch}
            name="Show Price in Search"
            description="When enabled, search results will directly show the price at each cafe."
        />
    </SettingsGroup>
);