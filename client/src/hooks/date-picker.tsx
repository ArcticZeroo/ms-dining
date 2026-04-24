import { isSameDate } from '@msdining/common/util/date-util';
import { useEffect, useMemo, useRef } from 'react';
import { DiningClient } from '../api/client/dining.ts';
import { CafeDatePicker } from '../components/cafes/date/date-picker.tsx';
import { ApplicationSettings } from '../constants/settings.ts';
import { SelectedDateContext } from '../context/time.ts';
import { ValueNotifier } from '../util/events.ts';
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
    // todo: this breaks on weekends/eow?
    return undefined;
}

export const useSelectedDisplayDateString = () => {
    const selectedDate = useValueNotifierContext(SelectedDateContext);
    return useMemo(() => {
        return selectedDate.toLocaleDateString();
    }, [selectedDate]);
}

// If the selected date was "today" the last time it was set (e.g. on initial
// load, or because the user explicitly navigated to today), automatically
// advance to the new "today" when the calendar day rolls over while the page
// stays open. This avoids stale menu fetches when the browser is left open
// overnight.
export const useAutoAdvanceSelectedDate = (selectedDateNotifier: ValueNotifier<Date>) => {
    const lastKnownTodayRef = useRef<Date | null>(null);

    useEffect(() => {
        const updateLastKnownToday = (value: Date) => {
            const today = DiningClient.getTodayDateForMenu();
            lastKnownTodayRef.current = isSameDate(value, today) ? today : null;
        };

        updateLastKnownToday(selectedDateNotifier.value);

        const onSelectedDateChanged = (value: Date) => {
            updateLastKnownToday(value);
        };

        selectedDateNotifier.addListener(onSelectedDateChanged);

        const maybeAdvanceToToday = () => {
            const lastKnownToday = lastKnownTodayRef.current;
            if (lastKnownToday == null) {
                return;
            }

            const today = DiningClient.getTodayDateForMenu();
            if (!isSameDate(lastKnownToday, today)) {
                selectedDateNotifier.value = today;
            }
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                maybeAdvanceToToday();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        // Also poll periodically so that the date advances even if the tab
        // remains visible across midnight (or the weekend->Monday rollover).
        const intervalId = window.setInterval(maybeAdvanceToToday, 60 * 1000);

        return () => {
            selectedDateNotifier.removeListener(onSelectedDateChanged);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.clearInterval(intervalId);
        };
    }, [selectedDateNotifier]);
};