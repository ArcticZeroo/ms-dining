import { useEffect, useState } from 'react';
import { ValueNotifier } from '../util/events.ts';

export const useValueNotifier = <T>(valueNotifier: ValueNotifier<T>) => {
    const [value, setValue] = useState(valueNotifier.value);

    useEffect(() => {
        const listener = (value: T) => setValue(value);
        valueNotifier.addListener(listener);
        return () => valueNotifier.removeListener(listener);
    }, []);

    return value;
}