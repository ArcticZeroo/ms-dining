import { create } from 'zustand';
import { mutative } from 'zustand-mutative';
import { DiningClient } from '../../api/client/dining.ts';
import { ApplicationSettings } from '../../constants/settings.ts';
import { getInitialDateFromUrl } from '../../util/url.ts';

const computeInitialDate = (): Date =>
    ApplicationSettings.allowFutureMenus.value
        ? getInitialDateFromUrl()
        : DiningClient.getTodayDateForMenu();

interface ISelectedDateStore {
    date: Date;
    setDate(date: Date): void;
    resetToToday(): void;
}

export const useSelectedDateStore = create<ISelectedDateStore>()(mutative((set) => ({
    date: computeInitialDate(),
    setDate:      (date) => set((state) => {
        state.date = date;
    }),
    resetToToday: () => set((state) => {
        state.date = DiningClient.getTodayDateForMenu();
    }),
})));

/**
 * Per-setting selector hook. Components only re-render when the date itself
 * changes (Object.is on Date instances; we always call setDate with a fresh
 * Date object).
 */
export const useSelectedDate = (): Date => useSelectedDateStore((state) => state.date);

/**
 * Non-hook write helpers for use in event handlers and other contexts that
 * shouldn't take a hook dependency on the store value.
 */
export const setSelectedDate = (date: Date) => useSelectedDateStore.getState().setDate(date);
export const resetSelectedDateToToday = () => useSelectedDateStore.getState().resetToToday();
