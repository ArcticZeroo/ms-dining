export class ValueNotifier<T> {
    protected _listeners: Array<(value: T, oldValue: T) => void> = [];

    constructor(protected _value: T) {
    }

    get value(): T {
        return this._value;
    }

    set value(value: T) {
        const oldValue = this._value;
        this._value = value;
        for (const listener of this._listeners) {
            listener(value, oldValue);
        }
    }

    addListener(listener: (value: T, oldValue: T) => void) {
        this._listeners.push(listener);
    }

    removeListener(listener: (value: T, oldValue: T) => void) {
        const index = this._listeners.indexOf(listener);
        if (index !== -1) {
            this._listeners.splice(index, 1);
        }
    }
}

export class ValueNotifierSet<T> extends ValueNotifier<Set<T>> {
    add(value: T) {
        const newValue = new Set(this._value);

        if (newValue.has(value)) {
            return;
        }

        newValue.add(value);
        this.value = newValue;
    }

    delete(value: T) {
        const newValue = new Set(this._value);

        if (!newValue.has(value)) {
            return;
        }

        newValue.delete(value);
        this.value = newValue;
    }

    size() {
        return this._value.size;
    }
}

export abstract class RefCountedValueNotifier<T> extends ValueNotifier<T> {
    // Returns a tear-down function like useEffect
    abstract setup(): () => void;
    private _tearDownCallback: (() => void) | null = null;

    addListener(listener: (value: T, oldValue: T) => void) {
        super.addListener(listener);
        if (this._listeners.length === 1) {
            this._tearDownCallback = this.setup();
        }
    }

    removeListener(listener: (value: T, oldValue: T) => void) {
        super.removeListener(listener);
        if (this._listeners.length === 0) {
            this._tearDownCallback?.();
        }
    }
}