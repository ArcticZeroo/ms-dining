export interface IDeferred<TValue> {
    promise: Promise<TValue>;
    resolve: (value: TValue | PromiseLike<TValue>) => void;
    reject: (reason?: unknown) => void;
}

/**
 * Creates a manually controlled promise for tests that need to hold async work
 * pending across render, unmount, or user-event boundaries.
 */
export const deferred = <TValue>(): IDeferred<TValue> => {
    let resolveDeferred!: IDeferred<TValue>['resolve'];
    let rejectDeferred!: IDeferred<TValue>['reject'];

    const promise = new Promise<TValue>((resolve, reject) => {
        resolveDeferred = resolve;
        rejectDeferred = reject;
    });

    return {
        promise,
        resolve: resolveDeferred,
        reject:  rejectDeferred,
    };
};
