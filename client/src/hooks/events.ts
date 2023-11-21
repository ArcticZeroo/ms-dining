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