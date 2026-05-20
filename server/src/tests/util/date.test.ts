import { ICafe } from '../../shared/models/cafe.js';
import Router from '@koa/router';
import { getDateForMenuRequest, getDateStringForMenuRequest, isCafeAvailable } from '../../main/util/date.js';
import { fromDateString, getMinimumDateForMenu, toDateString } from '@msdining/common/util/date-util';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Build a minimal Koa RouterContext that satisfies getTrimmedQueryParam.
// `as unknown as Router.RouterContext` is the narrowest cast that lets us
// drive only the surface area these helpers touch (ctx.query).
const makeCtx = (query: Record<string, string | string[] | undefined>): Router.RouterContext =>
    ({ query } as unknown as Router.RouterContext);

// Pinned to a known weekday so window math is predictable.
const PINNED_NOW = new Date('2024-06-19T12:00:00Z'); // Wednesday

describe('isCafeAvailable', () => {
    it('returns true when cafe has no firstAvailable date', () => {
        const cafe: ICafe = {
            name: 'Test Cafe',
            id: 'test',
        };

        assert(isCafeAvailable(cafe));
    });

    it('return true when cafe is available (fixed date)', () => {
        const now = fromDateString('2022-01-01');
        const firstAvailable = fromDateString('2021-01-01');

        const cafe: ICafe = {
            name: 'Test Cafe',
            id: 'test',
            firstAvailable
        };

        assert(isCafeAvailable(cafe, now));
    });

    it('returns false when cafe is not available (fixed date)', () => {
        const now = fromDateString('2021-01-01');
        const firstAvailable = fromDateString('2022-01-01');

        const cafe: ICafe = {
            name: 'Test Cafe',
            id: 'test',
            firstAvailable
        };

        assert(!isCafeAvailable(cafe, now));
    });

    it('returns true when cafe is available (automatic date=now)', () => {
        const firstAvailable = new Date();
        firstAvailable.setMonth(firstAvailable.getMonth() - 1);

        const cafe: ICafe = {
            name: 'Test Cafe',
            id: 'test',
            firstAvailable
        };

        assert(isCafeAvailable(cafe));
    });

    it('returns false when cafe is not available (automatic date=now)', () => {
        const firstAvailable = new Date();
        firstAvailable.setMonth(firstAvailable.getMonth() + 1);

        const cafe: ICafe = {
            name: 'Test Cafe',
            id: 'test',
            firstAvailable
        };

        assert(!isCafeAvailable(cafe));
    });
});

// 8d97ca0: getDateStringForMenuRequest / getDateForMenuRequest must no longer
// silently clamp invalid or out-of-window date params - they return null so
// the route can short-circuit instead of returning data for the wrong day.
describe('getDateForMenuRequest', () => {
    it('returns null when the date query param is missing', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        assert.equal(getDateForMenuRequest(makeCtx({})), null);
    });

    it('returns null when the date query param is an empty / whitespace string', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        assert.equal(getDateForMenuRequest(makeCtx({ date: '' })), null);
        assert.equal(getDateForMenuRequest(makeCtx({ date: '   ' })), null);
    });

    it('returns null when the date query param is an array (not a string)', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        assert.equal(getDateForMenuRequest(makeCtx({ date: ['2024-06-19', '2024-06-20'] })), null);
    });

    it('returns null for an unparseable date string', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        assert.equal(getDateForMenuRequest(makeCtx({ date: 'not-a-date' })), null);
    });

    it('returns null when the date is outside the 30-day request window (future)', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        // 60 days after pinned now, well past the 30-day window.
        assert.equal(getDateForMenuRequest(makeCtx({ date: '2024-08-18' })), null);
    });

    it('returns null when the date is outside the 30-day request window (past)', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        assert.equal(getDateForMenuRequest(makeCtx({ date: '2024-04-01' })), null);
    });

    it('returns the date when it is the same day as "now"', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        const result = getDateForMenuRequest(makeCtx({ date: '2024-06-19' }));
        assert.ok(result instanceof Date);
        assert.equal(toDateString(result!), '2024-06-19');
    });

    it('returns the date when it is within the window (future, weekday)', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        const result = getDateForMenuRequest(makeCtx({ date: '2024-06-25' }));
        assert.ok(result instanceof Date);
        assert.equal(toDateString(result!), '2024-06-25');
    });

    it('returns the date when it is within the window (past, weekday)', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        const result = getDateForMenuRequest(makeCtx({ date: '2024-06-10' }));
        assert.ok(result instanceof Date);
        assert.equal(toDateString(result!), '2024-06-10');
    });

    it('trims whitespace around an otherwise-valid date string', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        const result = getDateForMenuRequest(makeCtx({ date: '  2024-06-19  ' }));
        assert.ok(result instanceof Date);
        assert.equal(toDateString(result!), '2024-06-19');
    });
});

describe('getDateStringForMenuRequest', () => {
    it('returns null when getDateForMenuRequest would return null', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        assert.equal(getDateStringForMenuRequest(makeCtx({})), null);
        assert.equal(getDateStringForMenuRequest(makeCtx({ date: 'garbage' })), null);
        assert.equal(getDateStringForMenuRequest(makeCtx({ date: '2099-01-01' })), null);
    });

    it('returns the canonical YYYY-MM-DD string for a valid in-window date', (t) => {
        t.mock.timers.enable({ apis: ['Date'], now: PINNED_NOW });
        assert.equal(getDateStringForMenuRequest(makeCtx({ date: '2024-06-19' })), '2024-06-19');
    });
});

// 65c0ebf: the original bug stored firstWeeklyMenusDate as a shared Date
// object that was returned (and mutated by callers via setDate). The fix
// stores it as a numeric time and constructs a fresh Date inside the function.
// The function moved from server/src/util/date.ts to common/src/util/date-util.ts
// after this fix, but the regression still applies — assert here that calling
// it from the server side honors the contract.
describe('getMinimumDateForMenu (regression coverage for 65c0ebf)', () => {
    it('clamps dates before the weekly-menus baseline (2023-10-31) to the baseline itself', (t) => {
        // Pin "now" to before the baseline; the function should clamp.
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2023-10-15T12:00:00') });
        const result = getMinimumDateForMenu();
        assert.equal(toDateString(result), toDateString(fromDateString('2023-10-31')));
    });

    it('returns a Monday of the relevant week for dates after the baseline', (t) => {
        // Pinned Wednesday 2024-06-19 -> previous Monday 2024-06-17.
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2024-06-19T12:00:00') });
        const result = getMinimumDateForMenu();
        assert.equal(result.getDay(), 1, 'returned date must be a Monday');
        assert.equal(toDateString(result), '2024-06-17');
    });

    it('does not mutate the baseline between calls (regression: baseline used to be shared)', (t) => {
        // Pin to a date that triggers the baseline-clamp branch.
        t.mock.timers.enable({ apis: ['Date'], now: new Date('2023-10-10T12:00:00') });

        const first = getMinimumDateForMenu();
        const firstString = toDateString(first);

        // Mutate the returned Date - the old implementation shared the
        // baseline reference, so this used to corrupt subsequent calls.
        first.setFullYear(first.getFullYear() + 5);

        const second = getMinimumDateForMenu();
        assert.equal(toDateString(second), firstString, 'second call must not reflect mutations to the first result');
        assert.notStrictEqual(first, second, 'each call should return a fresh Date instance');
    });
});