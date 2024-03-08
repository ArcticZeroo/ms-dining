import { ValueNotifier } from '../util/events.ts';
import { ISerializedCartItemsByCafeId } from '../models/cart.ts';
import { isDuckTypeSerializedCartItem } from '../util/typeguard.ts';

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

export class CartSetting extends Setting<ISerializedCartItemsByCafeId | null> {
    constructor(name: string) {
        super(name, CartSetting.deserialize(name));
    }

    static deserialize(name: string): ISerializedCartItemsByCafeId | null {
        try {
            const value = localStorage.getItem(name);

            if (!value) {
                return null;
            }

            const data = JSON.parse(value);

            if (!data || typeof data !== 'object') {
                throw new Error('Data is not an object');
            }

            for (const serializedItems of Object.values(data)) {
                if (!Array.isArray(serializedItems)) {
                    throw new Error('Serialized items is not an array');
                }

                if (!serializedItems.every(isDuckTypeSerializedCartItem)) {
                    throw new Error('Serialized items contains invalid items');
                }
            }

            return data;
        } catch {
            return null;
        }
    }

    protected serialize(value: ISerializedCartItemsByCafeId) {
        localStorage.setItem(this.name, JSON.stringify(value));
    }
}