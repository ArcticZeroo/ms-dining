import { SettingsContext } from '../../context/settings.ts';
import { useContext } from 'react';
import './settings.css';
import { ApplicationSettings } from '../../api/settings.ts';
import { useDiningHalls } from '../../hooks/dining-halls.ts';
import { IDiningHall } from '../../models/dining-halls.ts';

export const SettingsPage = () => {
    const [settingsData, setSettingsData] = useContext(SettingsContext);
    const diningHalls = useDiningHalls();

    const toggleShowImages = () => {
        const showImages = !settingsData.showImages;
        console.log('show images clicked, toggling to new setting:', showImages);
        setSettingsData({ ...settingsData, showImages });
        ApplicationSettings.showImages.set(showImages);
    }

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
                <div className="setting">
                    <label htmlFor="setting-show-images" className="setting-info">
                        <div className="setting-name">
                            Enable Images
                        </div>
                        <div className="setting-description">
                            Enables images in menu headers, menu items, and search.
                            <br/>
                            Can cause some layout issues on mobile devices when enabled.
                        </div>
                    </label>
                    <input type="checkbox"
                           id="setting-show-images"
                           checked={settingsData.showImages}
                           onChange={toggleShowImages}/>
                </div>
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
    );
};