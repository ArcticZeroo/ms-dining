export const sum = (iterable: Iterable<number>) => {
    let total = 0;
    for (const item of iterable) {
        total += item;
    }
    return total;
}