export class ValueNotifier<T> {
    protected _onChangeListeners: Array<(value: T, oldValue: T) => void> = [];

    constructor(protected _value: T) {
    }

    get value(): T {
        return this._value;
    }

    set value(value: T) {
        const oldValue = this._value;
        this._value = value;
        for (const listener of this._onChangeListeners) {
            listener(value, oldValue);
        }
    }

    addListener(listener: (value: T, oldValue: T) => void) {
        this._onChangeListeners.push(listener);
    }

    removeListener(listener: (value: T, oldValue: T) => void) {
        const index = this._onChangeListeners.indexOf(listener);
        if (index !== -1) {
            this._onChangeListeners.splice(index, 1);
        }
    }
}