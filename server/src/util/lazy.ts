type CreateCallback<T> = () => T;

const UNINITIALIZED_LAZY_SYMBOL = Symbol();

export const lazy = <T>(createCallback: CreateCallback<T>): CreateCallback<T> => {
    let value: T | typeof UNINITIALIZED_LAZY_SYMBOL = UNINITIALIZED_LAZY_SYMBOL;

    return () => {
        if (value === UNINITIALIZED_LAZY_SYMBOL) {
            value = createCallback();
        }

        return value;
    };
}