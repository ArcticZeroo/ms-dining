import React, { useCallback, useEffect, useState } from 'react';
import { ValueNotifier } from '../util/events.ts';

export const useValueNotifier = <T>(valueNotifier: ValueNotifier<T>) => {
    const [value, setValue] = useState(valueNotifier.value);

    useEffect(() => {
        const listener = (value: T) => setValue(value);
        valueNotifier.addListener(listener);
        return () => valueNotifier.removeListener(listener);
    }, [valueNotifier]);

    return value;
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
 */
export const useValueNotifierSetTarget = <T>(valueNotifier: ValueNotifier<Set<T>>, targetValue: T) => {
    const [exists, setExists] = useState(() => valueNotifier.value.has(targetValue));

    useEffect(() => {
        const listener = (value: Set<T>) => setExists(value.has(targetValue));
        valueNotifier.addListener(listener);
        return () => valueNotifier.removeListener(listener);
    }, [targetValue, valueNotifier]);

    return exists;
}