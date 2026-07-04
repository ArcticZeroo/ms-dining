import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildComparisonPairs, computePriceIncreaseStats, IPriceComparisonRow } from './compute.js';
import { fiscalYearForDateString, getItemChangeForPair, getPricePairKey } from '@msdining/common/util/price-history';

const row = (menuItemId: string, fromAmount: number, toAmount: number): IPriceComparisonRow => ({
    menuItemId,
    name:     `item-${menuItemId}`,
    cafeId:   'cafe-1',
    fromAmount,
    toAmount,
});

const rowAtCafe = (cafeId: string, menuItemId: string, fromAmount: number, toAmount: number): IPriceComparisonRow => ({
    menuItemId,
    name: `item-${menuItemId}`,
    cafeId,
    fromAmount,
    toAmount,
});

describe('computePriceIncreaseStats', () => {
    it('counts increased / decreased / unchanged', () => {
        const stats = computePriceIncreaseStats([
            row('a', 1.00, 1.10),
            row('b', 2.00, 2.00),
            row('c', 3.00, 2.50),
        ], 2025, 2026);

        assert.equal(stats.totalItems, 3);
        assert.equal(stats.increasedCount, 1);
        assert.equal(stats.decreasedCount, 1);
        assert.equal(stats.unchangedCount, 1);
        assert.equal(stats.increasedFraction, 0.3333);
        assert.equal(stats.biggestDecreasesByDollars.length, 1);
        assert.equal(stats.biggestDecreasesByDollars[0]!.menuItemId, 'c');
        assert.equal(stats.biggestDecreasesByDollars[0]!.increaseDollars, -0.5);
    });

    it('averages over increased items only and guards divide-by-zero', () => {
        const stats = computePriceIncreaseStats([row('a', 2.00, 2.00)], 2025, 2026);

        assert.equal(stats.increasedCount, 0);
        assert.equal(stats.averageIncreaseDollars, 0);
        assert.equal(stats.averageIncreasePercent, 0);
        assert.equal(stats.increasedFraction, 0);
    });

    it('excludes tiny-base items from percent lists but not dollar lists', () => {
        const stats = computePriceIncreaseStats([
            row('tiny', 0.10, 1.00),
            row('normal', 5.00, 6.00),
        ], 2025, 2026, { topCount: 5, minBasePriceForPercent: 1, unchangedThresholdPercent: 0.0001 });

        assert.equal(stats.increasedCount, 2);
        assert.equal(stats.biggestByPercent.length, 1);
        assert.equal(stats.biggestByPercent[0]!.menuItemId, 'normal');
        assert.equal(stats.biggestByDollars.length, 2);
    });

    it('handles empty input', () => {
        const stats = computePriceIncreaseStats([], 2025, 2026);

        assert.equal(stats.totalItems, 0);
        assert.equal(stats.increasedFraction, 0);
        assert.equal(stats.averageIncreaseDollars, 0);
    });
});

describe('buildComparisonPairs', () => {
    it('produces every from<to pair, sorted', () => {
        const pairs = buildComparisonPairs([2026, 2024, 2025]);
        assert.deepEqual(pairs.map(pair => pair.key), ['2024-2025', '2024-2026', '2025-2026']);
    });
});

describe('computePriceIncreaseStats perCafe', () => {
    it('summarizes increases per cafe, sorted by average percent descending', () => {
        const stats = computePriceIncreaseStats([
            rowAtCafe('a', '1', 10.00, 11.00),
            rowAtCafe('a', '2', 10.00, 10.00),
            rowAtCafe('b', '3', 10.00, 12.00),
        ], 2025, 2026);

        assert.equal(stats.perCafe.length, 2);
        assert.equal(stats.perCafe[0]!.cafeId, 'b');
        assert.equal(stats.perCafe[0]!.averageIncreasePercent, 0.2);
        assert.equal(stats.perCafe[0]!.totalItems, 1);
        assert.equal(stats.perCafe[1]!.cafeId, 'a');
        assert.equal(stats.perCafe[1]!.totalItems, 2);
        assert.equal(stats.perCafe[1]!.increasedCount, 1);
    });
});

describe('getItemChangeForPair', () => {
    it('computes the change when priced and present in both years', () => {
        const change = getItemChangeForPair({ pricesByYear: { 2025: 5.00, 2026: 6.00 }, presentYears: [2025, 2026] }, 2025, 2026);
        assert.equal(change?.increaseDollars, 1);
        assert.equal(change?.increasePercent, 0.2);
    });

    it('returns null when a price is missing', () => {
        assert.equal(getItemChangeForPair({ pricesByYear: { 2026: 6 }, presentYears: [2025, 2026] }, 2025, 2026), null);
    });

    it('returns null when not on the menu in a year', () => {
        assert.equal(getItemChangeForPair({ pricesByYear: { 2025: 5, 2026: 6 }, presentYears: [2026] }, 2025, 2026), null);
    });
});

describe('fiscalYearForDateString', () => {
    it('maps July onward to the current year and Jan–June to the previous year', () => {
        assert.equal(fiscalYearForDateString('2026-07-01'), 2026);
        assert.equal(fiscalYearForDateString('2026-12-31'), 2026);
        assert.equal(fiscalYearForDateString('2026-06-30'), 2025);
        assert.equal(fiscalYearForDateString('2026-01-15'), 2025);
    });
});

describe('getPricePairKey', () => {
    it('formats the pair key', () => {
        assert.equal(getPricePairKey(2025, 2026), '2025-2026');
    });
});
