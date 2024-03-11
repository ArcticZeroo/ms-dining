import { useEffect, useMemo } from 'react';
import { CafeDatePicker } from '../components/cafes/date/date-picker.tsx';
import { useValueNotifier, useValueNotifierContext } from './events.ts';
import { SelectedDateContext } from '../context/time.ts';
import { addDateToUrl } from '../util/url.ts';
import { ApplicationSettings } from '../constants/settings.ts';
import { isSameDate } from '@msdining/common/dist/util/date-util';

export const useDatePicker = () => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);

    useSelectedDateInUrl();

    return useMemo(() => {
        if (!allowFutureMenus) {
            return null;
        }

        return <CafeDatePicker/>
    }, [allowFutureMenus]);
}

export const useSelectedDateInUrl = () => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    useEffect(() => {
        addDateToUrl(selectedDate);
    }, [selectedDate]);
};

export const useIsTodaySelected = () => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    return isSameDate(selectedDate, new Date());
}