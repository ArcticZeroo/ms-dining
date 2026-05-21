import { useCallback, useEffect, useRef, useState } from 'react';

export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debouncedValue;
};

/**
 * Returns a debounced version of `callback` that delays invocation until
 * `delayMs` after the last call. Rapid calls coalesce — only the last
 * set of arguments is used when the timer fires.
 *
 * Also returns `flush()` to fire immediately (e.g. on blur / unmount).
 */
export const useDebouncedCallback = <TArgs extends unknown[]>(
    callback: (...args: TArgs) => void,
    delayMs: number,
): { call: (...args: TArgs) => void; flush: () => void } => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef<(() => void) | null>(null);

    const flush = useCallback(() => {
        if (timerRef.current != null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        pendingRef.current?.();
        pendingRef.current = null;
    }, []);

    const call = useCallback((...args: TArgs) => {
        if (timerRef.current != null) {
            clearTimeout(timerRef.current);
        }
        pendingRef.current = () => callback(...args);
        timerRef.current = setTimeout(flush, delayMs);
    }, [callback, delayMs, flush]);

    // Flush on unmount so pending updates aren't lost
    useEffect(() => flush, [flush]);

    return { call, flush };
};
