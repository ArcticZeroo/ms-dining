import { SettingsContext } from '../../../context/settings.ts';
import { useContext } from 'react';
import { ApplicationSettings } from '../../../api/settings.ts';
import { CafeView } from '../../../models/cafe.ts';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import './settings.css';
import { useVisibleViews } from '../../../hooks/views.ts';

export const SettingsPage = () => {
    const [settingsData, setSettingsData] = useContext(SettingsContext);
    const visibleViews = useVisibleViews();

    const toggleHomepageView = (view: CafeView) => {
        const viewId = view.value.id;

        const homepageViewIds = new Set(settingsData.homepageViewIds);
        if (homepageViewIds.has(viewId)) {
            homepageViewIds.delete(viewId);
        } else {
            homepageViewIds.add(viewId);
        }

        setSettingsData({ ...settingsData, homepageViewIds });
        ApplicationSettings.homepageViews.set(Array.from(homepageViewIds));
    };

    return (
        <div className="card settings">
            <div className="title">
                Settings
            </div>
            <div className="body">
                <BooleanSettingInput
                    setting={ApplicationSettings.showImages}
                    contextKey="showImages"
                    name="Show Images"
                    description="When enabled, images are shown in menu headers, menu items, and search."
                />
                <BooleanSettingInput
                    setting={ApplicationSettings.showCalories}
                    contextKey="showCalories"
                    name="Show Calories"
                />
                <BooleanSettingInput
                    setting={ApplicationSettings.useGroups}
                    contextKey="useGroups"
                    name="Allow Cafe Groups"
                />
                <BooleanSettingInput
                    setting={ApplicationSettings.requestMenusInBackground}
                    contextKey="requestMenusInBackground"
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
                                const isChecked = settingsData.homepageViewIds.has(viewId);
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