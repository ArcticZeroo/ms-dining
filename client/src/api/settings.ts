import { settingNames } from '../constants/settings.ts';
import { randomUserId } from '../util/random.ts';

const getBooleanSetting = (key: string, defaultValue: boolean) => {
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

const setBooleanSetting = (key: string, value: boolean) => {
    try {
        localStorage.setItem(key, value ? 'true' : 'false');
    } catch {
        // Do nothing - some security exception may have occurred.
    }
};

const getStringArraySetting = (key: string, delimiter: string = ';') => {
    try {
        const value = localStorage.getItem(key);
        if (value == null || value.trim().length === 0) {
            return [];
        }
        return value.split(delimiter);
    } catch {
        return [];
    }
};

const setStringArraySetting = (key: string, value: string[], delimiter: string = ';') => {
    try {
        if (value.length === 0) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, value.join(delimiter));
        }
    } catch {
        // Do nothing
    }
};

abstract class Setting<T> {
    protected constructor(
        public readonly name: string,
        public readonly defaultValue: T
    ) {
    }

    public abstract get(): T;

    public abstract set(value: T): void;
}

class BooleanSetting extends Setting<boolean> {
    constructor(name: string, defaultValue: boolean) {
        super(name, defaultValue);
    }

    public get() {
        return getBooleanSetting(this.name, this.defaultValue);
    }

    public set(value: boolean) {
        setBooleanSetting(this.name, value);
    }
}

class StringArraySetting extends Setting<Array<string>> {
    constructor(name: string, defaultValue: Array<string>) {
        super(name, defaultValue);
    }

    public get() {
        return getStringArraySetting(this.name);
    }

    public set(value: Array<string>) {
        setStringArraySetting(this.name, value);
    }
}

class StringSetting extends Setting<string> {
    constructor(name: string, defaultValue: string) {
        super(name, defaultValue);
    }

    public get() {
        try {
            return localStorage.getItem(this.name) ?? this.defaultValue;
        } catch {
            return this.defaultValue;
        }
    }

    public set(value: string) {
        try {
            localStorage.setItem(this.name, value);
        } catch {
            // Do nothing
        }
    }
}

export const ApplicationSettings = {
    showImages:          new BooleanSetting(settingNames.showImages, true /*defaultValue*/),
    lastUsedDiningHalls: new StringArraySetting(settingNames.lastUsedDiningHalls, [] /*defaultValue*/),
    homepageDiningHalls: new StringArraySetting(settingNames.homepageDiningHalls, [] /*defaultValue*/),
    visitorId:           new StringSetting(settingNames.visitorId, '' /*defaultValue*/)
};

export const getVisitorId = () => {
    const visitorId = ApplicationSettings.visitorId.get();
    if (visitorId.length === 0) {
        const newVisitorId = randomUserId();
        ApplicationSettings.visitorId.set(newVisitorId);
        return newVisitorId;
    }
    return visitorId;
};