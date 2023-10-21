import { randomUserId } from '../util/random.ts';
import { ValueNotifier } from '../util/events.ts';

const getBooleanSetting = (key: string, defaultValue: boolean) => {
    try {
        const value = localStorage.getItem(key);
        if (!value) {
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

const getStringSetting = (key: string, defaultValue: string) => {
    try {
        return localStorage.getItem(key) ?? defaultValue;
    } catch {
        return defaultValue;
    }
}

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

export abstract class Setting<T> extends ValueNotifier<T> {
    protected constructor(
        public readonly name: string,
        initialValue: T
    ) {
        super(initialValue);
    }

    get value() {
        return this._value;
    }

    set value(value: T) {
        this.serialize(this._value);
        this._value = value;
    }

    protected abstract serialize(value: T): void;
}

export class BooleanSetting extends Setting<boolean> {
    constructor(name: string, defaultValue: boolean) {
        super(name, getBooleanSetting(name, defaultValue));
    }

    protected serialize(value: boolean) {
        setBooleanSetting(this.name, value);
    }
}

export class StringArraySetting extends Setting<Array<string>> {
    constructor(name: string) {
        super(name, getStringArraySetting(name));
    }

    protected serialize(value: Array<string>) {
        setStringArraySetting(this.name, value);
    }
}

export class StringSetSetting extends Setting<Set<string>> {
    constructor(name: string) {
        super(name, new Set(getStringArraySetting(name)));
    }

    protected serialize(value: Set<string>) {
        setStringArraySetting(this.name, Array.from(value));
    }
}

export class StringSetting extends Setting<string> {
    constructor(name: string, defaultValue: string = '') {
        super(name, getStringSetting(name, defaultValue));
    }

    protected serialize(value: string) {
        localStorage.setItem(this.name, value);
    }
}

export const ApplicationSettings = {
    useGroups:                new BooleanSetting('useGroups', true /*defaultValue*/),
    showImages:               new BooleanSetting('showImages', false /*defaultValue*/),
    showCalories:             new BooleanSetting('showCalories', true /*defaultValue*/),
    showDescriptions:         new BooleanSetting('showDescription', true /*defaultValue*/),
    requestMenusInBackground: new BooleanSetting('requestMenusInBackground', true /*defaultValue*/),
    rememberCollapseState:    new BooleanSetting('rememberCollapseState', false /*defaultValue*/),
    lastUsedCafeIds:          new StringArraySetting('lastUsedDiningHalls'),
    homepageViews:            new StringSetSetting('homepageDiningHalls'),
    collapsedStations:        new StringSetSetting('collapsedStations'),
    collapsedCafeIds:         new StringSetSetting('collapsedCafeIds'),
    visitorId:                new StringSetting('visitorId')
} as const;

export const getVisitorId = () => {
    const visitorId = ApplicationSettings.visitorId.value;
    if (visitorId.length === 0) {
        const newVisitorId = randomUserId();
        ApplicationSettings.visitorId.value = newVisitorId;
        return newVisitorId;
    }
    return visitorId;
};