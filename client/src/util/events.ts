export class ValueNotifier<T> {
    protected readonly _listeners: Set<(value: T, oldValue: T) => void> = new Set();

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
        const wasAdded = !this._listeners.has(listener);
        this._listeners.add(listener);
        return wasAdded;
    }

    removeListener(listener: (value: T, oldValue: T) => void) {
        return this._listeners.delete(listener);
    }
}

export class ValueNotifierSet<T> extends ValueNotifier<Set<T>> {
    add(value: T) {
        if (this._value.has(value)) {
            return;
        }

        const newValue = new Set(this._value);

        newValue.add(value);
        this.value = newValue;
    }

    delete(value: T) {
        if (!this._value.has(value)) {
            return;
        }

        const newValue = new Set(this._value);
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
        const wasAdded = super.addListener(listener);
        if (wasAdded && this._listeners.size === 1) {
            this._tearDownCallback = this.setup();
        }
        return wasAdded;
    }

    removeListener(listener: (value: T, oldValue: T) => void) {
        const wasRemoved = super.removeListener(listener);
        if (wasRemoved && this._listeners.size === 0) {
            this._tearDownCallback?.();
            this._tearDownCallback = null;
        }
        return wasRemoved;
    }
}