import {
    fromDateString,
    getDaysSinceLastWeekday,
    getDaysUntilNextWeekday,
    getMinimumDateForMenu,
    getNowWithDaysInFuture,
    getSequentialDateGroups,
    nativeDayOfWeek,
    nativeDayOfWeekNames,
    toDateString,
} from '../../util/date-util.js';
import { describe, it } from 'node:test';
import * as assert from 'node:assert';

describe('DateUtil', () => {
    const sunday = new Date('2021-01-03T00:00:00');

    describe('getDaysUntilNextWeekday', () => {
        const expectedTable = [
            // start on sunday
            {
                [nativeDayOfWeek.Sunday]: 0,
                [nativeDayOfWeek.Monday]: 1,
                [nativeDayOfWeek.Tuesday]: 2,
                [nativeDayOfWeek.Wednesday]: 3,
                [nativeDayOfWeek.Thursday]: 4,
                [nativeDayOfWeek.Friday]: 5,
                [nativeDayOfWeek.Saturday]: 6
            },
            // start on monday
            {
                [nativeDayOfWeek.Sunday]: 6,
                [nativeDayOfWeek.Monday]: 0,
                [nativeDayOfWeek.Tuesday]: 1,
                [nativeDayOfWeek.Wednesday]: 2,
                [nativeDayOfWeek.Thursday]: 3,
                [nativeDayOfWeek.Friday]: 4,
                [nativeDayOfWeek.Saturday]: 5
            },
            // start on tuesday
            {
                [nativeDayOfWeek.Sunday]: 5,
                [nativeDayOfWeek.Monday]: 6,
                [nativeDayOfWeek.Tuesday]: 0,
                [nativeDayOfWeek.Wednesday]: 1,
                [nativeDayOfWeek.Thursday]: 2,
                [nativeDayOfWeek.Friday]: 3,
                [nativeDayOfWeek.Saturday]: 4
            },
            // start on wednesday
            {
                [nativeDayOfWeek.Sunday]: 4,
                [nativeDayOfWeek.Monday]: 5,
                [nativeDayOfWeek.Tuesday]: 6,
                [nativeDayOfWeek.Wednesday]: 0,
                [nativeDayOfWeek.Thursday]: 1,
                [nativeDayOfWeek.Friday]: 2,
                [nativeDayOfWeek.Saturday]: 3
            },
            // start on thursday
            {
                [nativeDayOfWeek.Sunday]: 3,
                [nativeDayOfWeek.Monday]: 4,
                [nativeDayOfWeek.Tuesday]: 5,
                [nativeDayOfWeek.Wednesday]: 6,
                [nativeDayOfWeek.Thursday]: 0,
                [nativeDayOfWeek.Friday]: 1,
                [nativeDayOfWeek.Saturday]: 2
            },
            // start on friday
            {
                [nativeDayOfWeek.Sunday]: 2,
                [nativeDayOfWeek.Monday]: 3,
                [nativeDayOfWeek.Tuesday]: 4,
                [nativeDayOfWeek.Wednesday]: 5,
                [nativeDayOfWeek.Thursday]: 6,
                [nativeDayOfWeek.Friday]: 0,
                [nativeDayOfWeek.Saturday]: 1
            },
            // start on saturday
            {
                [nativeDayOfWeek.Sunday]: 1,
                [nativeDayOfWeek.Monday]: 2,
                [nativeDayOfWeek.Tuesday]: 3,
                [nativeDayOfWeek.Wednesday]: 4,
                [nativeDayOfWeek.Thursday]: 5,
                [nativeDayOfWeek.Friday]: 6,
                [nativeDayOfWeek.Saturday]: 0
            }
        ];

        for (let i = 0; i < expectedTable.length; i++) {
            const now = new Date(sunday.getTime());
            now.setDate(now.getDate() + i);

            describe(`when starting on ${nativeDayOfWeekNames[now.getDay()]}`, () => {
                for (const [weekday, expectedDays] of Object.entries(expectedTable[i])) {
                    it(`should return ${expectedDays} for ${nativeDayOfWeekNames[weekday as keyof typeof nativeDayOfWeekNames]}`, () => {
                        const result = getDaysUntilNextWeekday(now, Number(weekday));
                        assert.equal(result, expectedDays);
                    });
                }
            });
        }
    });

    describe('getDaysSinceLastWeekday', () => {
        const expectedTable = [
            // start on sunday
            {
                [nativeDayOfWeek.Sunday]: 0,
                [nativeDayOfWeek.Monday]: 6,
                [nativeDayOfWeek.Tuesday]: 5,
                [nativeDayOfWeek.Wednesday]: 4,
                [nativeDayOfWeek.Thursday]: 3,
                [nativeDayOfWeek.Friday]: 2,
                [nativeDayOfWeek.Saturday]: 1
            },
            // start on monday
            {
                [nativeDayOfWeek.Sunday]: 1,
                [nativeDayOfWeek.Monday]: 0,
                [nativeDayOfWeek.Tuesday]: 6,
                [nativeDayOfWeek.Wednesday]: 5,
                [nativeDayOfWeek.Thursday]: 4,
                [nativeDayOfWeek.Friday]: 3,
                [nativeDayOfWeek.Saturday]: 2
            },
            // start on tuesday
            {
                [nativeDayOfWeek.Sunday]: 2,
                [nativeDayOfWeek.Monday]: 1,
                [nativeDayOfWeek.Tuesday]: 0,
                [nativeDayOfWeek.Wednesday]: 6,
                [nativeDayOfWeek.Thursday]: 5,
                [nativeDayOfWeek.Friday]: 4,
                [nativeDayOfWeek.Saturday]: 3
            },
            // start on wednesday
            {
                [nativeDayOfWeek.Sunday]: 3,
                [nativeDayOfWeek.Monday]: 2,
                [nativeDayOfWeek.Tuesday]: 1,
                [nativeDayOfWeek.Wednesday]: 0,
                [nativeDayOfWeek.Thursday]: 6,
                [nativeDayOfWeek.Friday]: 5,
                [nativeDayOfWeek.Saturday]: 4
            },
            // start on thursday
            {
                [nativeDayOfWeek.Sunday]: 4,
                [nativeDayOfWeek.Monday]: 3,
                [nativeDayOfWeek.Tuesday]: 2,
                [nativeDayOfWeek.Wednesday]: 1,
                [nativeDayOfWeek.Thursday]: 0,
                [nativeDayOfWeek.Friday]: 6,
                [nativeDayOfWeek.Saturday]: 5
            },
            // start on friday
            {
                [nativeDayOfWeek.Sunday]: 5,
                [nativeDayOfWeek.Monday]: 4,
                [nativeDayOfWeek.Tuesday]: 3,
                [nativeDayOfWeek.Wednesday]: 2,
                [nativeDayOfWeek.Thursday]: 1,
                [nativeDayOfWeek.Friday]: 0,
                [nativeDayOfWeek.Saturday]: 6
            },
            // start on saturday
            {
                [nativeDayOfWeek.Sunday]: 6,
                [nativeDayOfWeek.Monday]: 5,
                [nativeDayOfWeek.Tuesday]: 4,
                [nativeDayOfWeek.Wednesday]: 3,
                [nativeDayOfWeek.Thursday]: 2,
                [nativeDayOfWeek.Friday]: 1,
                [nativeDayOfWeek.Saturday]: 0
            }
        ];

        for (let i = 0; i < expectedTable.length; i++) {
            const now = new Date(sunday.getTime());
            now.setDate(now.getDate() + i);

            describe(`when starting on ${nativeDayOfWeekNames[now.getDay()]}`, () => {
                for (const [weekday, expectedDays] of Object.entries(expectedTable[i])) {
                    it(`should return ${expectedDays} for ${nativeDayOfWeekNames[weekday as keyof typeof nativeDayOfWeekNames]}`, () => {
                        const result = getDaysSinceLastWeekday(now, Number(weekday));
                        assert.equal(result, expectedDays);
                    });
                }
            });
        }
    });
});

describe('getSequentialDateGroups', () => {
    it('returns empty array when given empty array', () => {
        assert.deepStrictEqual(getSequentialDateGroups([]), []);
    });

    it('returns single group when given one date', () => {
        const date = new Date();
        assert.deepStrictEqual(getSequentialDateGroups([date]), [[date]]);
    });

    it('returns single group when given two sequential dates', () => {
        const date1 = new Date();
        const date2 = new Date(date1);
        date2.setDate(date2.getDate() + 1);

        assert.deepStrictEqual(getSequentialDateGroups([date1, date2]), [[date1, date2]]);
    });

    it('returns two groups when given three dates with a gap', () => {
        const date1 = new Date();
        const date2 = new Date(date1);
        date2.setDate(date2.getDate() + 1);
        const date3 = new Date(date2);
        date3.setDate(date3.getDate() + 2);

        assert.deepStrictEqual(getSequentialDateGroups([date1, date2, date3]), [[date1, date2], [date3]]);
    });

    it('returns two groups when given three dates with a gap and minGroupSizeToAvoidBreakup=2', () => {
        const date1 = new Date();
        const date2 = new Date(date1);
        date2.setDate(date2.getDate() + 1);
        const date3 = new Date(date2);
        date3.setDate(date3.getDate() + 2);

        assert.deepStrictEqual(getSequentialDateGroups([date1, date2, date3], 2), [[date1, date2], [date3]]);
    });

    it('returns three groups when given three dates with a gap and minGroupSizeToAvoidBreakup=3', () => {
        const date1 = new Date();
        const date2 = new Date(date1);
        date2.setDate(date2.getDate() + 1);
        const date3 = new Date(date2);
        date3.setDate(date3.getDate() + 2);

        assert.deepStrictEqual(getSequentialDateGroups([date1, date2, date3], 3), [[date1], [date2], [date3]]);
    });

    it('returns one group when given three sequential dates and minGroupSizeToAvoidBreakup=3', () => {
        const date1 = new Date();
        const date2 = new Date(date1);
        const date3 = new Date(date1);

        date2.setDate(date2.getDate() + 1);
        date3.setDate(date3.getDate() + 2);

        assert.deepStrictEqual(getSequentialDateGroups([date1, date2, date3], 3), [[date1, date2, date3]]);
    });

    it('returns two groups when given three sequential dates and one with a gap, and minGroupSizeToAvoidBreakup=3', () => {
        const date1 = new Date();
        const date2 = new Date(date1);
        const date3 = new Date(date1);
        const date4 = new Date(date1);

        date2.setDate(date2.getDate() + 1);
        date3.setDate(date3.getDate() + 2);
        date4.setDate(date4.getDate() + 4);

        assert.deepStrictEqual(getSequentialDateGroups([date1, date2, date3, date4], 3), [[date1, date2, date3], [date4]]);
    });

    // It's important that the group to be broken up is at the end.
    it('returns two groups when given two sequential dates and minGroupSizeToAvoidBreakup=3', () => {
        const date1 = new Date();
        const date2 = new Date(date1);
        date2.setDate(date2.getDate() + 1);

        assert.deepStrictEqual(getSequentialDateGroups([date1, date2], 3), [[date1], [date2]]);
    });
});

// 96bec42: getDaysUntilNextWeekday flipped `<= 0` to `< 0` so same-day returns
// 0 (today) instead of 7 (next week). The optional `excludeToday` flag exists
// to restore the old behavior on demand. This block locks both contracts down.
describe('getDaysUntilNextWeekday excludeToday boundary', () => {
    const wednesday = new Date('2024-06-19T12:00:00'); // weekday=3

    it('returns 0 for same-day with excludeToday=false (default)', () => {
        assert.equal(getDaysUntilNextWeekday(wednesday, nativeDayOfWeek.Wednesday), 0);
    });

    it('returns 7 for same-day with excludeToday=true', () => {
        assert.equal(getDaysUntilNextWeekday(wednesday, nativeDayOfWeek.Wednesday, true), 7);
    });

    it('returns the same value as default for forward-in-week targets regardless of excludeToday', () => {
        assert.equal(getDaysUntilNextWeekday(wednesday, nativeDayOfWeek.Friday), 2);
        assert.equal(getDaysUntilNextWeekday(wednesday, nativeDayOfWeek.Friday, true), 2);
    });

    it('returns the wrapped value for past-in-week targets regardless of excludeToday', () => {
        // Wed -> Mon: previous day in week, must wrap to next Monday (5 days).
        assert.equal(getDaysUntilNextWeekday(wednesday, nativeDayOfWeek.Monday), 5);
        assert.equal(getDaysUntilNextWeekday(wednesday, nativeDayOfWeek.Monday, true), 5);
    });

    it('handles Friday/Saturday/Sunday boundary correctly (regression weekdays)', () => {
        const friday = new Date('2024-06-21T12:00:00');   // weekday=5
        const saturday = new Date('2024-06-22T12:00:00'); // weekday=6
        const sunday = new Date('2024-06-23T12:00:00');   // weekday=0

        assert.equal(getDaysUntilNextWeekday(friday, nativeDayOfWeek.Friday), 0);
        assert.equal(getDaysUntilNextWeekday(friday, nativeDayOfWeek.Monday), 3);

        assert.equal(getDaysUntilNextWeekday(saturday, nativeDayOfWeek.Monday), 2);
        assert.equal(getDaysUntilNextWeekday(saturday, nativeDayOfWeek.Saturday), 0);

        assert.equal(getDaysUntilNextWeekday(sunday, nativeDayOfWeek.Monday), 1);
        assert.equal(getDaysUntilNextWeekday(sunday, nativeDayOfWeek.Sunday), 0);
    });
});

describe('getDaysSinceLastWeekday excludeToday boundary', () => {
    const wednesday = new Date('2024-06-19T12:00:00');

    it('returns 0 for same-day with excludeToday=false (default)', () => {
        assert.equal(getDaysSinceLastWeekday(wednesday, nativeDayOfWeek.Wednesday), 0);
    });

    it('returns 7 for same-day with excludeToday=true', () => {
        assert.equal(getDaysSinceLastWeekday(wednesday, nativeDayOfWeek.Wednesday, true), 7);
    });

    it('returns the wrapped value for future-in-week targets', () => {
        assert.equal(getDaysSinceLastWeekday(wednesday, nativeDayOfWeek.Friday), 5);
        assert.equal(getDaysSinceLastWeekday(wednesday, nativeDayOfWeek.Friday, true), 5);
    });
});

describe('getNowWithDaysInFuture', () => {
    it('returns "today" when offset is 0', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2024-06-19T12:00:00') });
        assert.equal(toDateString(getNowWithDaysInFuture(0)), '2024-06-19');
    });

    it('returns tomorrow when offset is +1', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2024-06-19T12:00:00') });
        assert.equal(toDateString(getNowWithDaysInFuture(1)), '2024-06-20');
    });

    it('returns yesterday when offset is -1', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2024-06-19T12:00:00') });
        assert.equal(toDateString(getNowWithDaysInFuture(-1)), '2024-06-18');
    });

    it('rolls month boundaries forward correctly', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2024-01-31T12:00:00') });
        assert.equal(toDateString(getNowWithDaysInFuture(1)), '2024-02-01');
    });

    it('rolls month boundaries backward correctly', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2024-03-01T12:00:00') });
        assert.equal(toDateString(getNowWithDaysInFuture(-1)), '2024-02-29');
    });
});

describe('getMinimumDateForMenu', () => {
    it('clamps to the firstWeeklyMenus baseline (2023-10-31) for dates earlier than it', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2023-10-15T12:00:00') });
        const result = getMinimumDateForMenu();
        assert.equal(toDateString(result), toDateString(fromDateString('2023-10-31')));
    });

    it('returns the Monday of the relevant week for a Wednesday well after the baseline', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2024-06-19T12:00:00') });
        const result = getMinimumDateForMenu();
        assert.equal(result.getDay(), nativeDayOfWeek.Monday, `expected a Monday, got ${nativeDayOfWeekNames[result.getDay()]}`);
        assert.equal(toDateString(result), '2024-06-17');
    });

    it('returns a Monday for a Friday after the baseline (same-week Monday)', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2024-06-21T12:00:00') });
        const result = getMinimumDateForMenu();
        assert.equal(result.getDay(), nativeDayOfWeek.Monday);
        assert.equal(toDateString(result), '2024-06-17');
    });

    it('returns a fresh Date each call - the baseline is never mutated (regression 65c0ebf)', (t) => {
        // Use the baseline branch so we exercise the exact place the bug lived.
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2023-10-10T12:00:00') });

        const first = getMinimumDateForMenu();
        const firstString = toDateString(first);

        first.setFullYear(first.getFullYear() + 5);

        const second = getMinimumDateForMenu();
        assert.equal(toDateString(second), firstString, 'second call should be unaffected by mutation of first result');
        assert.notStrictEqual(first, second, 'each call should return a distinct Date instance');
    });
});
