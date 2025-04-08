interface IRangeParams {
    inclusive?: boolean;
    step?: number;
}

export function* range(start: number, end: number, { inclusive = false, step = 1 }: IRangeParams) {
    if (inclusive) {
        for (let i = start; i <= end; i += step) {
            yield i;
        }
    } else {
        for (let i = start; i < end; i += step) {
            yield i;
        }
    }
}