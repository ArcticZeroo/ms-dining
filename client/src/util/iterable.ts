export function *chain<T>(...iterators: Array<Iterable<T>>) {
    for (const iterator of iterators) {
        yield* iterator;
    }
}

export const keysOf = <T extends object>(obj: T): Array<keyof T> => Object.keys(obj) as Array<keyof T>;

export const tryGetUniversalValue = <T>(values: Iterable<T>): T | null => {
    const uniqueValues = new Set(values);
    if (uniqueValues.size === 1) {
        return Array.from(uniqueValues)[0]!;
    }
    return null;
}