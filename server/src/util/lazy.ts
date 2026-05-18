type CreateCallback<T> = () => T;

const UNINITIALIZED_LAZY_SYMBOL = Symbol();

export interface Lazy<T> {
    /** The cached value. Computed on first access. */
    readonly value: T;
    /** True if `value` has been computed and not since reset. */
    readonly isInitialized: boolean;
    /** Discard the cached value so the next access recomputes. */
    reset(): void;
}

/**
 * Wraps a synchronous factory so it runs at most once. Subsequent accesses
 * to `.value` return the cached result. Use `reset()` to discard the cache
 * (useful in tests). For async factories use `lazyAsync`, which gives
 * concurrent callers the same in-flight promise.
 *
 * Example:
 *   const getClient = lazy(() => new SomeClient());
 *   getClient.value.doThing();
 */
export const lazy = <T>(createCallback: CreateCallback<T>): Lazy<T> => {
    let cached: T | typeof UNINITIALIZED_LAZY_SYMBOL = UNINITIALIZED_LAZY_SYMBOL;
    return {
        get value(): T {
            if (cached === UNINITIALIZED_LAZY_SYMBOL) {
                cached = createCallback();
            }
            return cached;
        },
        get isInitialized(): boolean {
            return cached !== UNINITIALIZED_LAZY_SYMBOL;
        },
        reset(): void {
            cached = UNINITIALIZED_LAZY_SYMBOL;
        },
    };
}

export interface LazyAsync<T> {
    /**
     * The cached promise. Computed on first access. Concurrent accesses
     * before the promise resolves share the same in-flight promise. If the
     * promise rejects, the cache is cleared so the next access retries.
     */
    readonly value: Promise<T>;
    /** True if `value` has been accessed and not since reset (or rejected). */
    readonly isInitialized: boolean;
    /** Discard the cached promise so the next access recomputes. */
    reset(): void;
}

/**
 * Wraps an async factory so it runs at most once. Concurrent accessors
 * share the same in-flight promise (single-flight). On rejection, the
 * next access retries. Use `reset()` to discard the cache.
 *
 * Example:
 *   const initialized = lazyAsync(async () => { ... });
 *   await initialized.value;
 */
export const lazyAsync = <T>(createCallback: () => Promise<T>): LazyAsync<T> => {
    let promise: Promise<T> | undefined;
    return {
        get value(): Promise<T> {
            if (promise == null) {
                const current = createCallback().catch(err => {
                    // Allow retries on failure: clear only if `current` is
                    // still the active promise (otherwise a concurrent
                    // reset() + retry has already installed a new one).
                    if (promise === current) {
                        promise = undefined;
                    }
                    throw err;
                });
                promise = current;
            }
            return promise;
        },
        get isInitialized(): boolean {
            return promise != null;
        },
        reset(): void {
            promise = undefined;
        },
    };
}