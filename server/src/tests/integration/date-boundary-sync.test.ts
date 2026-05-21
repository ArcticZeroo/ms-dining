/**
 * Integration test for `78af7e4` — sessions saved with `daysInFuture > 0`
 * must be filed under the future date the session was constructed for,
 * NOT under `toDateString(new Date())` which is always "today".
 *
 * Original bug (server/src/api/cafe/cache/update.ts pre-fix):
 *     await saveSessionAsync({
 *         ...
 *         dateString: toDateString(new Date()),   // ← always today
 *     });
 * The fix uses `this.dateString` (which respects `daysInFuture`).
 *
 * To catch this regression we drive the production caller
 * (DailyCafeUpdateSession.populateAsync) end-to-end with daysInFuture=3
 * and assert the rows land under today+3, NOT today. A regression that
 * reverts to `toDateString(new Date())` at the save call site would
 * write rows under today and fail this test.
 */

import { after, before, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { DailyCafeUpdateSession } from '../../worker/data/cafe/job/update.js';
import { usePrismaClient } from '../../worker/data/storage/client.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import { ICafe } from '../../shared/models/cafe.js';
import { ENVIRONMENT_SETTINGS } from '../../shared/util/env.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';

const CAFE_ID = 'cafe25';
// A weekday so weekend-skip logic doesn't short-circuit the boot.
const WEDNESDAY = new Date('2026-05-13T18:00:00Z');
const DAYS_IN_FUTURE = 3;

let ctx: IntegrationTestContext;
let cafe: ICafe;
let todayString: string;
let futureDateString: string;

before(async () => {
    mock.timers.enable({ apis: ['Date'], now: WEDNESDAY });

    todayString = DateUtil.toDateString(new Date());
    futureDateString = DateUtil.toDateString(DateUtil.getNowWithDaysInFuture(DAYS_IN_FUTURE));
    assert.notEqual(
        todayString,
        futureDateString,
        `test premise broken: today (${todayString}) and today+${DAYS_IN_FUTURE} (${futureDateString}) produced the same string`,
    );

    ctx = await createIntegrationTestContext();
    // Skip weekly repair so the test only triggers our explicit populate.
    (ENVIRONMENT_SETTINGS as unknown as { skipWeeklyRepair: boolean }).skipWeeklyRepair = true;

    const found = ALL_CAFES.find(c => c.id === CAFE_ID);
    assert.ok(found, `${CAFE_ID} should exist in ALL_CAFES`);
    cafe = found;
}, { timeout: 60_000 });

after(async () => {
    await ctx.cleanup();
    mock.timers.reset();
});

test('DailyCafeUpdateSession(daysInFuture=3).populateAsync writes rows under today+3, not today', { timeout: 60_000 }, async () => {
    // Construct a session for 3 days in the future. The buggy caller used
    // `toDateString(new Date())` here — which would write rows under TODAY,
    // not today+3.
    const session = new DailyCafeUpdateSession(DAYS_IN_FUTURE);
    assert.equal(session.dateString, futureDateString, 'session.dateString getter precondition');

    // Skip every cafe except ours so the test stays fast and assertions
    // are about exactly one cafe's data.
    const skipCafeIds = new Set(ALL_CAFES.map(c => c.id).filter(id => id !== cafe.id));
    await session.populateAsync(skipCafeIds);

    const counts = await usePrismaClient(async (client) => ({
        futureCafe: await client.dailyCafe.count({
            where: { cafeId: cafe.id, dateString: futureDateString },
        }),
        todayCafe: await client.dailyCafe.count({
            where: { cafeId: cafe.id, dateString: todayString },
        }),
        futureStations: await client.dailyStation.count({
            where: { cafeId: cafe.id, dateString: futureDateString },
        }),
        todayStations: await client.dailyStation.count({
            where: { cafeId: cafe.id, dateString: todayString },
        }),
        futureMenuItems: await client.dailyMenuItem.count({
            where: { category: { station: { cafeId: cafe.id, dateString: futureDateString } } },
        }),
        todayMenuItems: await client.dailyMenuItem.count({
            where: { category: { station: { cafeId: cafe.id, dateString: todayString } } },
        }),
    }));

    assert.equal(
        counts.futureCafe, 1,
        `DailyCafe should be saved under future date ${futureDateString}; got ${counts.futureCafe}`,
    );
    assert.equal(
        counts.todayCafe, 0,
        `no DailyCafe row should appear under today (${todayString}); got ${counts.todayCafe} ` +
        `— regression: caller passed toDateString(new Date()) instead of this.dateString`,
    );
    assert.ok(
        counts.futureStations > 0,
        `expected DailyStation rows under future date ${futureDateString}; got ${counts.futureStations}`,
    );
    assert.equal(
        counts.todayStations, 0,
        `no DailyStation rows should appear under today (${todayString}); got ${counts.todayStations} (date-string regression)`,
    );
    assert.ok(
        counts.futureMenuItems > 0,
        `expected DailyMenuItem rows under future date ${futureDateString}; got ${counts.futureMenuItems}`,
    );
    assert.equal(
        counts.todayMenuItems, 0,
        `no DailyMenuItem rows should appear under today (${todayString}); got ${counts.todayMenuItems} (date-string regression)`,
    );
});

test('no rows exist on any date OTHER than the futureDateString the session was constructed for', async () => {
    const allDistinct = await usePrismaClient(async (client) => {
        const cafes = await client.dailyCafe.findMany({
            where: { cafeId: cafe.id },
            select: { dateString: true },
        });
        const stations = await client.dailyStation.findMany({
            where: { cafeId: cafe.id },
            select: { dateString: true },
        });
        return new Set([...cafes, ...stations].map(r => r.dateString));
    });
    assert.deepEqual([...allDistinct], [futureDateString]);
});
