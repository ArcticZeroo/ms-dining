import { useMemo } from 'react';
import { ApplicationSettings } from '../api/settings.ts';
import { CafeDatePicker } from '../components/cafes/date/date-picker.tsx';
import { useValueNotifier } from './events.ts';
export const useDatePicker = () => {
	const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);

	return useMemo(() => {
		if (!allowFutureMenus) {
			return null;
		}

		return <CafeDatePicker/>
	}, [allowFutureMenus]);
}