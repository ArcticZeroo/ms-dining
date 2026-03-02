import { DateUtil } from "@msdining/common";
import { DiningClient } from '../api/client/dining.ts';
import { DebugSettings } from '../constants/settings.js';

export const addDateToUrl = (date: Date) => {
    const url = new URL(window.location.href);

    if (DateUtil.isSameDate(date, DiningClient.getTodayDateForMenu())) {
        url.searchParams.delete('date');
    } else {
        url.searchParams.set('date', DateUtil.toDateString(date));
    }

    window.history.pushState({}, '', url.toString());
}

export const getInitialDateFromUrl = () => {
    const url = new URL(window.location.href);
    const dateString = url.searchParams.get('date');

    if (dateString != null) {
        const date = DateUtil.fromDateString(dateString);
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    return DiningClient.getTodayDateForMenu();
}

export const getSearchUrl = (query: string) => {
    const pageTarget = DebugSettings.enableMapPage.value ? 'map' : 'search';
    return `/${pageTarget}?q=${encodeURIComponent(query)}`;
}