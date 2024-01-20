import { ValueNotifier } from '../util/events.ts';
import { randomUserId } from '../util/random.ts';

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

export abstract class Setting<T> extends ValueNotifier<T> {
    private _shouldPersist: boolean = true;

    protected constructor(
        public readonly name: string,
        initialValue: T
    ) {
        super(initialValue);
    }

    get shouldPersist() {
        return this._shouldPersist;
    }

    set shouldPersist(shouldPersist: boolean) {
        this._shouldPersist = shouldPersist;
        if (shouldPersist) {
            this.serialize(this.value);
        }
    }

    get value() {
        return this._value;
    }

    set value(value: T) {
        if (this.shouldPersist) {
            this.serialize(value);
        }
        super.value = value;
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

    push(value: string) {
        this.value = [...this.value, value];
    }

    clear() {
        this.value = [];
    }
}

export class StringSetSetting extends Setting<Set<string>> {
    constructor(name: string, shouldPersist: boolean = true) {
        const initialValue = shouldPersist ? new Set(getStringArraySetting(name)) : new Set<string>();
        super(name, initialValue);
        this.shouldPersist = shouldPersist;
    }

    protected serialize(value: Set<string>) {
        setStringArraySetting(this.name, Array.from(value));
    }

    add(value: string) {
        const newValue = new Set(this.value);
        newValue.add(value);
        this.value = newValue;
    }

    delete(value: string) {
        const newValue = new Set(this.value);
        newValue.delete(value);
        this.value = newValue;
    }

    clear() {
        this.value = new Set();
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

export class NumberSetting extends Setting<number> {
    constructor(name: string, defaultValue: number) {
        super(name, NumberSetting.deserialize(name, defaultValue));
    }

    private static deserialize(name: string, defaultValue: number) {
        try {
            const valueRaw = localStorage.getItem(name);

            if (!valueRaw) {
                return defaultValue;
            }

            const value = Number(valueRaw);

            if (Number.isNaN(value)) {
                return defaultValue;
            }

            return value;
        } catch {
            return defaultValue;
        }
    }

    protected serialize(value: number) {
        localStorage.setItem(this.name, value.toString());
    }
}

export const ApplicationSettings = {
    shouldUseGroups:               new BooleanSetting('shouldUseGroups', true /*defaultValue*/),
    shouldCondenseNumbers:         new BooleanSetting('shouldCondenseNumbers', true /*defaultValue*/),
    showImages:                    new BooleanSetting('showImages', true /*defaultValue*/),
    showCalories:                  new BooleanSetting('showCalories', true /*defaultValue*/),
    showDescriptions:              new BooleanSetting('showDescription', true /*defaultValue*/),
    showTags:                      new BooleanSetting('showTags', true /*defaultValue*/),
    showFavoritesOnHome:           new BooleanSetting('showFavoritesOnHome', true /*defaultValue*/),
    collapseCafesByDefault:        new BooleanSetting('collapseCafesByDefault', false /*defaultValue*/),
    allowFutureMenus:              new BooleanSetting('allowFutureMenus', false /*defaultValue*/),
    allowOnlineOrdering:           new BooleanSetting('PROBABLY_BROKEN_ONLINE_ORDERING_DO_NOT_USE', false /*defaultValue*/),
    enablePriceFilters:            new BooleanSetting('enablePriceFilters', false /*defaultValue*/),
    suppressMultiCafeOrderWarning: new BooleanSetting('suppressMultiCafeOrderWarning', false /*defaultValue*/),
    lastUsedCafeIds:               new StringArraySetting('lastUsedDiningHalls'),
    homepageViews:                 new StringSetSetting('homepageDiningHalls'),
    highlightTagNames:             new StringSetSetting('highlightTagNames'),
    favoriteItemNames:             new StringSetSetting('favoriteItemNames'),
    favoriteStationNames:          new StringSetSetting('favoriteStationNames'),
    collapsedStations:             new StringSetSetting('collapsedStations'),
    visitorId:                     new StringSetting('visitorId'),
    minimumPrice:                  new NumberSetting('minimumPrice', 0),
    maximumPrice:                  new NumberSetting('maximumPrice', 10),
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