import { SettingsContext } from '../../context/settings.ts';
import { useContext } from 'react';
import { setBooleanSetting } from '../../api/settings.ts';
import { settingNames } from '../../constants/settings.ts';
import './settings.css';

export const SettingsPage = () => {
    const [settings, setSettings] = useContext(SettingsContext);

    const toggleShowImages = () => {
        const showImages = !settings.showImages;
        console.log('show images clicked, toggling to new setting:', showImages);
        setSettings({ ...settings, showImages });
        setBooleanSetting(settingNames.showImages, showImages);
    }

    return (
        <div className="card settings">
            <div className="title">
                Settings
            </div>
            <div className="body">
                <div className="setting">
                    <label htmlFor="setting-show-images">
                        Enable Images
                    </label>
                    <input type="checkbox"
                           id="setting-show-images"
                           checked={settings.showImages}
                           onChange={toggleShowImages}/>
                </div>
            </div>
        </div>
    );
};