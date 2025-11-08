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

export const sum = (values: Iterable<number>): number => {
    return Array.from(values).reduce((a, b) => a + b, 0);
}

export const joinCommaSeparatedList = (items: string[]): string => {
    if (items.length === 0) {
        return '';
    }

    if (items.length === 1) {
        return items[0]!;
    }

    if (items.length === 2) {
        return `${items[0]} and ${items[1]}`;
    }

    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}