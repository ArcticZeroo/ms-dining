import { ApplicationSettings } from '../../../api/settings.ts';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import './settings.css';
import { HomepageViewsSetting } from './homepage-views-setting.tsx';
import { CustomKeySetting } from './custom-key-setting.tsx';
import { useValueNotifier } from '../../../hooks/events.ts';

export const SettingsPage = () => {
    const shouldUseGroups = useValueNotifier(ApplicationSettings.shouldUseGroups);

    return (
        <div className="card settings">
            <div className="title">
                Settings
            </div>
            <div className="body">
                <div className="setting" id="setting-homepage">
                    <div className="setting-info">
                        <div className="setting-name">
                            <span className="material-symbols-outlined">
                                visibility
                            </span>
                            Display Settings
                        </div>
                        <div className="setting-description">
                            Select the information that you want to appear on cafe menus, search, and headers.
                        </div>
                    </div>
                    <div className="setting-chips">
                        <BooleanSettingInput
                            icon="photo_camera"
                            setting={ApplicationSettings.showImages}
                            name="Show Images"
                            isChip={true}
                        />
                        <BooleanSettingInput
                            icon="local_fire_department"
                            setting={ApplicationSettings.showCalories}
                            name="Show Calories"
                            isChip={true}
                        />
                        <BooleanSettingInput
                            icon="edit"
                            setting={ApplicationSettings.showDescriptions}
                            name="Show Descriptions"
                            isChip={true}
                        />
                    </div>
                </div>
                <BooleanSettingInput
                    icon="group"
                    setting={ApplicationSettings.shouldUseGroups}
                    name="Group Cafes"
                    description="When enabled, cafe menus are shown in location-based groups, and the navigation menu is condensed."
                />
                {
                    shouldUseGroups && (
                        <BooleanSettingInput
                            icon="tag"
                            setting={ApplicationSettings.shouldCondenseNumbers}
                            name="Condense Numbered Cafes"
                            description="When enabled, numbered cafes are condensed into tiles in the navigation menu."
                        />
                    )
                }
                <HomepageViewsSetting/>
                <BooleanSettingInput
                    icon="schedule"
                    setting={ApplicationSettings.allowFutureMenus}
                    name="(Experimental) Allow Future Menus"
                    description={
                        <>
                            When enabled, a date picker will be shown on cafe pages, and you can see future menu
                            information in search.
                            <br/>
                            Menus are known to change frequently before online ordering is actually available!
                            In some cases, menus have changed as late as 9am on the day that they are available.
                        </>
                    }
                />
                <BooleanSettingInput
                    icon="expand_content"
                    setting={ApplicationSettings.rememberCollapseState}
                    name="Remember Collapse/Expand State"
                />
                <CustomKeySetting/>
            </div>
        </div>
    );
};