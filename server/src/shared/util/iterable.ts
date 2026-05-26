export const keysOf = <T extends object>(obj: T): Array<keyof T> => Object.keys(obj) as Array<keyof T>;

export const sum = (iterable: Iterable<number>) => {
    let total = 0;
    for (const item of iterable) {
        total += item;
    }
    return total;
}