import { SettingsContext } from '../../context/settings.ts';
import React, { useContext } from 'react';
import { setBooleanSetting } from '../../api/settings.ts';
import { settingNames } from '../../constants/settings.ts';

export const SettingsPage = () => {
    const [settings, setSettings] = useContext(SettingsContext);

    const onShowImagesChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
        const showImages = event.target.checked;
        setSettings({ ...settings, showImages: event.target.checked });
        setBooleanSetting(settingNames.showImages, showImages);
    }

    return (
        <div className="card settings">
            <div className="title">
                Settings
            </div>
            <div className="body">
                <table>
                    <tbody>
                    <tr>
                        <td>
                            <label htmlFor="setting-show-images">
                                Enable Images
                            </label>
                        </td>
                        <td>
                            <input type="checkbox"
                                   id="setting-show-images"
                                   checked={settings.showImages}
                                   onChange={onShowImagesChanged}/>
                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};