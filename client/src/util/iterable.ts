export function *chain<T>(...iterators: Array<Iterable<T>>) {
    for (const iterator of iterators) {
        yield* iterator;
    }
}

export const keysOf = <T extends object>(obj: T): Array<keyof T> => Object.keys(obj) as Array<keyof T>;