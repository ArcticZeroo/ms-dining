import { DateUtil } from '@msdining/common';
import { isSameDate } from '@msdining/common/util/date-util';
import { useEffect, useMemo, useRef } from 'react';
import { DiningClient } from '../api/client/dining.ts';
import { CafeDatePicker } from '../components/cafes/date/date-picker.tsx';
import { ApplicationSettings } from '../constants/settings.ts';
import { setSelectedDate, useSelectedDate, useSelectedDateStore } from '../store/zustand/selected-date.ts';
import { addDateToUrl } from '../util/url.ts';
import { useValueNotifier } from './events.ts';

export const useDatePicker = () => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const selectedDate = useSelectedDate();

    useSelectedDateInUrl();

    return useMemo(() => {
        if (allowFutureMenus) {
            return <CafeDatePicker/>;
        }

        // Even with future menus disabled, the selected date may not be
        // "today" — e.g. on weekends DiningClient.getTodayDateForMenu() shifts
        // forward to Monday. Surface the date as a read-only display so the
        // user understands what the menu reflects.
        if (!DateUtil.isSameDate(selectedDate, new Date())) {
            return <CafeDatePicker showControls={false}/>;
        }

        return null;
    }, [allowFutureMenus, selectedDate]);
}

export const useSelectedDateInUrl = () => {
    const selectedDate = useSelectedDate();
    useEffect(() => {
        addDateToUrl(selectedDate);
    }, [selectedDate]);
};

export const useIsTodaySelected = () => {
    const selectedDate = useSelectedDate();
    return isSameDate(selectedDate, new Date());
}

export const useDateForSearch = () => {
    const allowFutureMenus = useValueNotifier(ApplicationSettings.allowFutureMenus);
    const selectedDate = useSelectedDate();

    if (!allowFutureMenus) {
        return selectedDate;
    }

    // If we don't provide a date, we'll get results for the whole week
    // todo: this breaks on weekends/eow?
    return undefined;
}

export const useSelectedDisplayDateString = () => {
    const selectedDate = useSelectedDate();
    return useMemo(() => {
        return selectedDate.toLocaleDateString();
    }, [selectedDate]);
}

// If the selected date was "today" the last time it was set (e.g. on initial
// load, or because the user explicitly navigated to today), automatically
// advance to the new "today" when the calendar day rolls over while the page
// stays open. This avoids stale menu fetches when the browser is left open
// overnight.
//
// Must be called once near the root.
export const useAutoAdvanceSelectedDate = () => {
    const lastKnownTodayRef = useRef<Date | null>(null);

    useEffect(() => {
        const updateLastKnownToday = (value: Date) => {
            const today = DiningClient.getTodayDateForMenu();
            lastKnownTodayRef.current = isSameDate(value, today) ? today : null;
        };

        updateLastKnownToday(useSelectedDateStore.getState().date);

        const unsubscribe = useSelectedDateStore.subscribe((state, prev) => {
            if (state.date !== prev.date) {
                updateLastKnownToday(state.date);
            }
        });

        const maybeAdvanceToToday = () => {
            const lastKnownToday = lastKnownTodayRef.current;
            if (lastKnownToday == null) {
                return;
            }

            const today = DiningClient.getTodayDateForMenu();
            if (!isSameDate(lastKnownToday, today)) {
                setSelectedDate(today);
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
            unsubscribe();
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.clearInterval(intervalId);
        };
    }, []);
};