export const getBooleanSetting = (key: string, defaultValue: boolean) => {
    const value = localStorage.getItem(key);
    if (value === null) {
        return defaultValue;
    }
    return value === 'true';
};

export const setBooleanSetting = (key: string, value: boolean) => {
    localStorage.setItem(key, value ? 'true' : 'false');
};