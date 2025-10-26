import {
    getDaysSinceLastWeekday,
    getDaysUntilNextWeekday, getSequentialDateGroups,
    nativeDayOfWeek,
    nativeDayOfWeekNames
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
