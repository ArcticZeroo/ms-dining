export const getBooleanSetting = (key: string, defaultValue: boolean) => {
    try {
        const value = localStorage.getItem(key);
        if (value === null) {
            return defaultValue;
        }
        return value === 'true';
    } catch {
        return defaultValue;
    }
};

export const setBooleanSetting = (key: string, value: boolean) => {
    try {
        localStorage.setItem(key, value ? 'true' : 'false');
    } catch {
        // Do nothing - some security exception may have occurred.
    }
};