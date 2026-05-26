type NotPromise<T> = T extends Promise<any> ? never : T;

export const jsonStringifyWithoutNull = <T>(value: NotPromise<T>) => JSON.stringify(value, (_, value) => {
    if (value == null) {
        return undefined;
    }

    if (value instanceof Set) {
        return Array.from(value);
    }

    return value;
});