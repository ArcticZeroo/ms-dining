import React, { useCallback, useMemo, useSyncExternalStore } from 'react';
import { ValueNotifier } from '../util/events.ts';

/**
 * Reads a ValueNotifier reactively. Backed by `useSyncExternalStore` so we get
 * concurrent-mode tearing protection without writing the subscribe/snapshot
 * plumbing in every consumer.
 */
export const useValueNotifier = <T>(valueNotifier: ValueNotifier<T>): T => {
    const subscribe = useCallback((onStoreChange: () => void) => {
        const listener = () => onStoreChange();
        valueNotifier.addListener(listener);
        return () => {
            valueNotifier.removeListener(listener);
        };
    }, [valueNotifier]);

    const getSnapshot = useCallback(() => valueNotifier.value, [valueNotifier]);

    return useSyncExternalStore(subscribe, getSnapshot);
};

export const useValueNotifierAsState = <T>(valueNotifier: ValueNotifier<T>) => {
    const value = useValueNotifier(valueNotifier);
    const setValue = useCallback((newValue: T) => valueNotifier.value = newValue, [valueNotifier]);
    return [value, setValue] as const;
};

export const useValueNotifierContext = <T>(context: React.Context<ValueNotifier<T>>) => {
    const valueNotifier = React.useContext(context);
    return useValueNotifier(valueNotifier);
};

/**
 * Intended to be used in cases where the ValueNotifier exposes an entire set, but we only care about a particular
 * value's existence in the set (e.g. is my item id in the list of favorites), and we don't want to re-render
 * if another item is added or removed from the set.
 *
 * The boolean snapshot lets `useSyncExternalStore`'s default Object.is
 * comparison skip re-renders for set changes that don't affect our membership.
 */
export const useValueNotifierSetTarget = <T>(valueNotifier: ValueNotifier<Set<T>>, targetValue: T) => {
    const subscribe = useCallback((onStoreChange: () => void) => {
        const listener = () => onStoreChange();
        valueNotifier.addListener(listener);
        return () => {
            valueNotifier.removeListener(listener);
        };
    }, [valueNotifier]);

    const getSnapshot = useMemo(() => {
        return () => valueNotifier.value.has(targetValue);
    }, [valueNotifier, targetValue]);

    return useSyncExternalStore(subscribe, getSnapshot);
};