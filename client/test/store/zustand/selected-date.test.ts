import * as assert from 'node:assert';
import { beforeEach, describe, it } from 'vitest';
import { initializeSelectedDate, useSelectedDateStore } from '../../../src/store/zustand/selected-date.ts';
import { ApplicationSettings } from '../../../src/constants/settings.ts';

const seed = (date: Date) => useSelectedDateStore.setState({ date });

describe('useSelectedDateStore', () => {
    beforeEach(() => {
        seed(new Date('2026-01-01T00:00:00Z'));
    });

    it('setDate replaces the date', () => {
        const next = new Date('2026-06-01T00:00:00Z');
        useSelectedDateStore.getState().setDate(next);
        assert.strictEqual(useSelectedDateStore.getState().date, next);
    });

    it('resetToToday produces a date based on DiningClient.getTodayDateForMenu', () => {
        const farFuture = new Date('2099-01-01T00:00:00Z');
        seed(farFuture);

        useSelectedDateStore.getState().resetToToday();

        const stored = useSelectedDateStore.getState().date;
        assert.notStrictEqual(stored, farFuture, 'resetToToday replaces the date');
        // Within ~7 days of "now" (Mon-shift on weekends can push to Monday).
        const drift = Math.abs(stored.getTime() - Date.now());
        assert.ok(drift < 7 * 24 * 60 * 60 * 1000, `stored too far from now: drift=${drift}ms`);
    });

    it('initializeSelectedDate respects allowFutureMenus when reading from URL', () => {
        const originalAllowFutureMenus = ApplicationSettings.allowFutureMenus.value;
        try {
            ApplicationSettings.allowFutureMenus.value = false;

            seed(new Date('2099-01-01T00:00:00Z'));
            initializeSelectedDate();

            // With future menus disabled, init must snap to today regardless of
            // URL state — guards against a regression where settings flipped by
            // checkMigrationCookie() weren't honored because the store was
            // initialized at module load.
            const stored = useSelectedDateStore.getState().date;
            const drift = Math.abs(stored.getTime() - Date.now());
            assert.ok(drift < 7 * 24 * 60 * 60 * 1000, `stored too far from now: drift=${drift}ms`);
        } finally {
            ApplicationSettings.allowFutureMenus.value = originalAllowFutureMenus;
        }
    });
});
