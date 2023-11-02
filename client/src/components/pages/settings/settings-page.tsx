import { ApplicationSettings } from '../../../api/settings.ts';
import { CafeView } from '../../../models/cafe.ts';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import { useVisibleViews } from '../../../hooks/views.ts';
import { useValueNotifier } from '../../../hooks/events.ts';
import './settings.css';

export const SettingsPage = () => {
    const visibleViews = useVisibleViews();
    const homepageViewIds = useValueNotifier(ApplicationSettings.homepageViews);

    const toggleHomepageView = (view: CafeView) => {
        const viewId = view.value.id;
        if (homepageViewIds.has(viewId)) {
            ApplicationSettings.homepageViews.delete(viewId);
        } else {
            ApplicationSettings.homepageViews.add(viewId);
        }
    };

    return (
        <div className="card settings">
            <div className="title">
                Settings
            </div>
            <div className="body">
                <BooleanSettingInput
                    setting={ApplicationSettings.showImages}
                    name="Show Images"
                    description="When enabled, images are shown in menu headers, menu items, and search."
                />
                <BooleanSettingInput
                    setting={ApplicationSettings.showCalories}
                    name="Show Calories"
                />
                <BooleanSettingInput
                    setting={ApplicationSettings.showDescriptions}
                    name="Show Descriptions"
                />
                <BooleanSettingInput
                    setting={ApplicationSettings.useGroups}
                    name="Group Cafes"
                    description="When enabled, cafe menus are shown in location-based groups, and the navigation menu is condensed."
                />
                <BooleanSettingInput
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
                    setting={ApplicationSettings.requestMenusInBackground}
                    name="Enable Fetching Menus in Background"
                    description={
                        <>
                            When enabled, menus for each cafe will be fetched in the background in order to
                            facilitate faster search and menu switching.
                            <br/>
                            Menus are fetched 1 second apart from each other, with homepage cafes first and then
                            in order of last recently used.
                        </>
                    }
                />
                <BooleanSettingInput
                    setting={ApplicationSettings.rememberCollapseState}
                    name="Remember Collapse/Expand State"
                />
                <div className="setting" id="setting-homepage">
                    <div className="setting-info">
                        <div className="setting-name">
                            Homepage Views
                        </div>
                        <div className="setting-description">
                            Select the views that you want to appear on the homepage.
                        </div>
                    </div>
                    <div className="setting-data">
                        {
                            visibleViews.map(view => {
                                const viewId = view.value.id;
                                const htmlId = `setting-homepage-option-${viewId}`;
                                const isChecked = homepageViewIds.has(viewId);
                                return (
                                    <div className="setting-homepage-option" key={viewId}>
                                        <label htmlFor={htmlId}>
                                            {view.value.name}
                                        </label>
                                        <input type="checkbox"
                                               id={htmlId}
                                               checked={isChecked}
                                               onChange={() => toggleHomepageView(view)}/>
                                    </div>
                                )
                            })
                        }
                    </div>
                </div>
            </div>
        </div>
    )
        ;
};