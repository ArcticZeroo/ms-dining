import { BooleanSetting } from '../api/settings.ts';
import { useEffect, useState } from 'react';

const areRequiredSettingsEnabled = (requiredSettings: BooleanSetting[]) => requiredSettings.every(setting => setting.value);

export const useAreRequiredSettingsEnabled = (requiredSettings: BooleanSetting[]) => {
    const [isAllEnabled, setIsAllEnabled] = useState(() => areRequiredSettingsEnabled(requiredSettings));

    useEffect(() => {
        const updateIsAllEnabled = () => {
            setIsAllEnabled(areRequiredSettingsEnabled(requiredSettings));
        }

        for (const setting of requiredSettings) {
            setting.addListener(updateIsAllEnabled);
        }

        return () => {
            for (const setting of requiredSettings) {
                setting.removeListener(updateIsAllEnabled);
            }
        }
    }, [requiredSettings]);

    return isAllEnabled;
};