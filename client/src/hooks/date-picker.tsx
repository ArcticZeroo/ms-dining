import { isSameDate } from '@msdining/common/util/date-util';
import { useEffect, useMemo } from 'react';
import { CafeDatePicker } from '../components/cafes/date/date-picker.tsx';
import { ApplicationSettings } from '../constants/settings.ts';
import { SelectedDateContext } from '../context/time.ts';
import { addDateToUrl } from '../util/url.ts';
import { useValueNotifier, useValueNotifierContext } from './events.ts';

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

export const useDateForSearch = () => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const selectedDate = useValueNotifierContext(SelectedDateContext);

    if (!allowFutureMenus) {
        return selectedDate;
    }

    // If we don't provide a date, we'll get results for the whole week
    return undefined;
}