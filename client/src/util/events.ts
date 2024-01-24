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