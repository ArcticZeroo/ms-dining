import { SettingsContext } from '../../../context/settings.ts';
import { useContext } from 'react';
import { ApplicationSettings } from '../../../api/settings.ts';
import { useDiningHalls } from '../../../hooks/dining-halls.ts';
import { IDiningHall } from '../../../models/dining-halls.ts';
import { BooleanSettingInput } from './boolean-setting-input.tsx';
import './settings.css';

export const SettingsPage = () => {
    const [settingsData, setSettingsData] = useContext(SettingsContext);
    const diningHalls = useDiningHalls();

    const toggleHomepageDiningHall = (diningHall: IDiningHall) => {
        const homepageDiningHallIds = new Set(settingsData.homepageDiningHallIds);
        if (homepageDiningHallIds.has(diningHall.id)) {
            homepageDiningHallIds.delete(diningHall.id);
        } else {
            homepageDiningHallIds.add(diningHall.id);
        }
        setSettingsData({ ...settingsData, homepageDiningHallIds });
        ApplicationSettings.homepageDiningHalls.set(Array.from(homepageDiningHallIds));
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
                    name={<>Show Images</>}
                    description={
                        <>
                            When enabled, images are shown in menu headers, menu items, and search.
                            <br/>
                            Can cause some layout issues on mobile devices when enabled.
                        </>
                    }
                />
                <BooleanSettingInput
                    setting={ApplicationSettings.showCalories}
                    contextKey="showCalories"
                    name={<>Show Calories</>}
                />
                <BooleanSettingInput
                    setting={ApplicationSettings.requestMenusInBackground}
                    contextKey="requestMenusInBackground"
                    name={<>Enable Fetching Menus in Background</>}
                    description={
                        <>
                            When enabled, menus for each dining hall will be fetched in the background in order to
                            facilitate faster search and menu switching.
                            <br/>
                            Menus are fetched 1 second apart from each other, with homepage dining halls first and then
                            in order of last recently used.
                        </>
                    }
                />
                <div className="setting" id="setting-homepage">
                    <div className="setting-info">
                        <div className="setting-name">
                            Homepage Dining Halls
                        </div>
                        <div className="setting-description">
                            Select the dining halls you want to appear on the homepage.
                        </div>
                    </div>
                    <div className="setting-data">
                        {
                            diningHalls.map(diningHall => {
                                const id = `setting-homepage-option-${diningHall.id}`;
                                const isChecked = settingsData.homepageDiningHallIds.has(diningHall.id);
                                return (
                                    <div className="setting-homepage-option" key={diningHall.id}>
                                        <label htmlFor={id}>
                                            {diningHall.name}
                                        </label>
                                        <input type="checkbox"
                                               id={id}
                                               checked={isChecked}
                                               onChange={() => toggleHomepageDiningHall(diningHall)}/>
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