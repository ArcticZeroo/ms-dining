export interface MemoizedValueController<T> {
    invalidate: () => void;
    retrieve: () => Promise<T>;
}

export const memoByTime = <T, TArgs extends unknown[]>(retrieveValue: (...args: TArgs) => Promise<T>, keepTimeMs: number): MemoizedValueController<T> => {
    let lastValue: T;
    let lastValueTime: number;

    return {
        invalidate() {
            lastValue = undefined;
            lastValueTime = undefined;
        },
        async retrieve(...args: TArgs) {
            const now = Date.now();

            if (!lastValueTime || (now - lastValueTime > keepTimeMs)) {
                lastValue = await retrieveValue(...args);
                lastValueTime = now;
            }

            return lastValue;
        }
    };
}