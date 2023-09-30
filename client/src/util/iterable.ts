export function* chain<T>(...iterators: Array<Iterable<T>>) {
    for (const iterator of iterators) {
        yield* iterator;
    }
}