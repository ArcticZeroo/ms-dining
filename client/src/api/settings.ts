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

export abstract class Setting<T> {
	protected constructor(
		public readonly name: string,
		public readonly defaultValue: T
	) {
	}

	public abstract get(): T;

	public abstract set(value: T): void;
}

export class BooleanSetting extends Setting<boolean> {
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

export class StringArraySetting extends Setting<Array<string>> {
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

export class StringSetting extends Setting<string> {
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
	useGroups:                new BooleanSetting('useGroups', true /*defaultValue*/),
	showImages:               new BooleanSetting('showImages', false /*defaultValue*/),
	showCalories:             new BooleanSetting('showCalories', true /*defaultValue*/),
	requestMenusInBackground: new BooleanSetting('requestMenusInBackground', true /*defaultValue*/),
	lastUsedDiningHalls:      new StringArraySetting('lastUsedDiningHalls', [] /*defaultValue*/),
	homepageViews:            new StringArraySetting('homepageDiningHalls', [] /*defaultValue*/),
	visitorId:                new StringSetting('visitorId', '' /*defaultValue*/)
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