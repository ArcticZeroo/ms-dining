/**
 * Full-sync integration test.
 *
 * Exercises the same code path as production boot — performMenuBootTasks()
 * syncing ALL_CAFES through TestBuyOnDemandClient — then verifies the result
 * by both inspecting the DB and hitting the real HTTP endpoints.
 *
 * Scenarios covered:
 *   - 1 cafe is marked shut down via the config fixture (normal 200 response
 *     with isShutOffEnabled=true). Asserts shutdownState surfaces.
 *   - 1 cafe returns 410 on its concepts endpoint (true HTTP error). Asserts
 *     no daily menu for that cafe today.
 *   - All other cafes sync normally. Asserts the DB volume roughly matches
 *     what the fixture generator produced.
 *   - Tags + modifiers survive the round-trip from fixture → BoD client → DB.
 *   - HTTP API: /api/dining/, /api/dining/menu/:id/menu, /api/dining/search?q=
 *
 * This test is intentionally larger than smoke.test.ts. The smoke test
 * verifies the bootstrap works; this one verifies the bootstrap exercises
 * the real shape of the production code.
 */

import { after, before, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { getMinimumDateForMenu } from '@msdining/common/util/date-util';
import { performMenuBootTasks } from '../../worker/data/cafe/job/boot.js';
import { usePrismaClient } from '../../worker/data/storage/client.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import { isCafeAvailable } from '../../shared/util/date.js';
import { ENVIRONMENT_SETTINGS } from '../../shared/util/env.js';
import {
    CafeMenuResponseSchema,
    DiningCoreResponseSchema,
    MenuResponseSchema,
    SearchResponseSchema,
} from '@msdining/common/models/http';
import { VERSION_TAG } from '@msdining/common/constants/versions';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';
import { fetchJson } from '../test-server/test-helpers.js';

const SHUTDOWN_CAFE_ID = 'cafe83';     // small kiosk — closed for maintenance
const UNAVAILABLE_CAFE_ID = 'cafe109'; // returns 410 on concepts call
const SHUTDOWN_MESSAGE = 'Closed for maintenance — back Monday';

// Pinned weekday so production weekend-skip logic doesn't short-circuit boot.
const FAKE_NOW = new Date('2026-05-13T12:00:00Z'); // Wednesday

let ctx: IntegrationTestContext;
let baseUrl: string;
let todayString: string;

before(async () => {
    // Pin "now" to a weekday so production weekend-skip logic doesn't
    // short-circuit boot, AND so any time-sensitive code path during the
    // test (cache TTLs, menu date filters, etc.) sees a stable clock.
    // Restored in after().
    mock.timers.enable({ apis: ['Date'], now: FAKE_NOW });
    todayString = DateUtil.toDateString(new Date());

    ctx = await createIntegrationTestContext();

    // Skip weekly repair so the test only syncs today (not 5+ days).
    // Cast through unknown because ENVIRONMENT_SETTINGS is exported Readonly.
    (ENVIRONMENT_SETTINGS as unknown as { skipWeeklyRepair: boolean }).skipWeeklyRepair = true;

    // Pre-arrange test scenarios on the BoD test server.
    ctx.server.markCafeShutdown(SHUTDOWN_CAFE_ID, SHUTDOWN_MESSAGE);
    ctx.server.injectFailure({
        method: 'POST',
        // The concepts list endpoint — last segment is the displayProfileId,
        // and the path ends here for the discovery call (vs the deeper
        // /concepts/:dp/menus/:stationId path for tag fetch).
        pathPattern: /\/concepts\/[^/]+$/,
        cafeId: UNAVAILABLE_CAFE_ID,
        statusCode: 410,
    });

    // Drive the real production boot flow. Same call as src/main.ts:45.
    await performMenuBootTasks();

    baseUrl = await ctx.startWebserver();
}, { timeout: 120_000 });

after(async () => {
    await ctx.cleanup();
    mock.timers.reset();
});

test('boot syncs all cafes with the expected entity counts', async () => {
    const summary = ctx.server.getFixtureSummary();
    const unavailable = summary.perCafe.get(UNAVAILABLE_CAFE_ID);
    assert.ok(unavailable, `${UNAVAILABLE_CAFE_ID} should have a fixture`);

    // The unavailable cafe gets a Cafe row (its /config succeeded) but no
    // stations or items (the /concepts call failed with 410). Every other
    // cafe — including the shutdown one — syncs fully because shutdown is
    // an in-band signal, not a fetch failure.
    const expectedStations = summary.totals.stations - unavailable.stationCount;
    const expectedMenuItems = summary.totals.menuItems - unavailable.menuItemCount;
    const expectedDailyMenuItems = summary.totals.menuItemAppearances - unavailable.menuItemAppearanceCount;

    const counts = await usePrismaClient(async (client) => ({
        cafes: await client.cafe.count(),
        stations: await client.station.count(),
        menuItems: await client.menuItem.count(),
        dailyCafes: await client.dailyCafe.count({ where: { dateString: todayString } }),
        availableDailyCafes: await client.dailyCafe.count({
            where: { dateString: todayString, isAvailable: true },
        }),
        dailyStations: await client.dailyStation.count({ where: { dateString: todayString } }),
        dailyMenuItems: await client.dailyMenuItem.count({
            where: { category: { station: { dateString: todayString } } },
        }),
    }));

    assert.equal(counts.cafes, summary.totals.cafes);
    assert.equal(counts.stations, expectedStations);
    assert.equal(counts.menuItems, expectedMenuItems);
    assert.equal(counts.dailyStations, expectedStations);
    assert.equal(counts.dailyMenuItems, expectedDailyMenuItems);
    assert.equal(counts.dailyCafes, summary.totals.cafes);
    assert.equal(counts.availableDailyCafes, summary.totals.cafes - 1);
});

test('shutdown cafe is the only shut-down cafe', async () => {
    const dailyCafe = await usePrismaClient(client =>
        client.dailyCafe.findUnique({
            where: { dateString_cafeId: { dateString: todayString, cafeId: SHUTDOWN_CAFE_ID } },
            include: { shutdown: true },
        }));
    assert.ok(dailyCafe, `DailyCafe row should exist for ${SHUTDOWN_CAFE_ID}`);
    assert.ok(dailyCafe.shutdownMessageHash, 'shutdown should have been classified and hashed');
    assert.ok(dailyCafe.shutdown, 'CafeShutdown row should exist via FK');
    assert.equal(dailyCafe.shutdown.message, SHUTDOWN_MESSAGE);

    // No other cafe should have a shutdown hash today.
    const otherShutdownCafes = await usePrismaClient(client =>
        client.dailyCafe.findMany({
            where: {
                dateString: todayString,
                shutdownMessageHash: { not: null },
                cafeId: { not: SHUTDOWN_CAFE_ID },
            },
            select: { cafeId: true },
        }));
    assert.deepEqual(otherShutdownCafes, []);
});

test('unavailable (410) cafe is the only unavailable cafe', async () => {
    const dailyCafe = await usePrismaClient(client =>
        client.dailyCafe.findUnique({
            where: { dateString_cafeId: { dateString: todayString, cafeId: UNAVAILABLE_CAFE_ID } },
        }));
    assert.ok(dailyCafe, 'DailyCafe row should exist (Cafe.create ran during /config)');
    assert.equal(dailyCafe.isAvailable, false, '410 should produce isAvailable=false');

    // No DailyStation rows should exist for today for this cafe.
    const dailyStationCount = await usePrismaClient(client =>
        client.dailyStation.count({
            where: { cafeId: UNAVAILABLE_CAFE_ID, dateString: todayString },
        }));
    assert.equal(dailyStationCount, 0);

    // No other cafe should be marked unavailable today.
    const otherUnavailable = await usePrismaClient(client =>
        client.dailyCafe.findMany({
            where: {
                dateString: todayString,
                isAvailable: false,
                cafeId: { not: UNAVAILABLE_CAFE_ID },
            },
            select: { cafeId: true },
        }));
    assert.deepEqual(otherUnavailable, []);
});

test('menu items have tags and modifiers from fixtures', async () => {
    const summary = ctx.server.getFixtureSummary();
    const cafe25Summary = summary.perCafe.get('cafe25');
    assert.ok(cafe25Summary, 'cafe25 should have a fixture');

    const items = await usePrismaClient(client =>
        client.menuItem.findMany({
            where: { cafeId: 'cafe25' },
            include: {
                modifiers: { include: { modifier: { include: { choices: true } } } },
            },
        }));

    assert.equal(items.length, cafe25Summary.menuItemCount);

    const taggedItems = items.filter(i => i.tags != null && i.tags.length > 0);
    const itemsWithMods = items.filter(i => i.modifiers.length > 0);
    assert.equal(taggedItems.length, cafe25Summary.itemsWithTagsCount);
    assert.equal(itemsWithMods.length, cafe25Summary.itemsWithModifiersCount);

    // Every modifier persisted from the fixture has at least one choice.
    for (const item of itemsWithMods) {
        for (const entry of item.modifiers) {
            assert.ok(entry.modifier.choices.length > 0,
                `modifier ${entry.modifierId} on item ${item.id} should have choices`);
        }
    }
});

test('GET /api/dining/ returns exactly the available cafes', async () => {
    const body = await fetchJson(`${baseUrl}/api/dining/`, DiningCoreResponseSchema);

    // The route filters out cafes whose firstAvailableDate is past the
    // minimum-menu cutoff (i.e. unreleased) for clients that don't pass
    // the unreleased-cafes version tag (we don't, since fetch() sends none).
    const minimumDate = getMinimumDateForMenu();
    const expectedIds = new Set(
        ALL_CAFES.filter(c => isCafeAvailable(c, minimumDate)).map(c => c.id),
    );

    const responseIds = new Set(body.groups.flatMap(g => g.members.map(m => m.id)));
    assert.deepEqual(responseIds, expectedIds);
});

test('GET /api/dining/menu/cafe25/menu (legacy) returns stations + items', async () => {
    const summary = ctx.server.getFixtureSummary();
    const cafe25Summary = summary.perCafe.get('cafe25');
    assert.ok(cafe25Summary);

    const body = await fetchJson(
        `${baseUrl}/api/dining/menu/cafe25/menu?date=${todayString}`,
        CafeMenuResponseSchema,
    );

    assert.equal(body.isAvailable, true);
    assert.equal(body.shutdownState, undefined);
    assert.equal(body.stations.length, cafe25Summary.stationCount);

    // Every (item, category) pairing should appear exactly once. Because
    // items can intentionally appear under multiple categories within a
    // station (mirrors real BoD behavior like Typhoon), the response total
    // matches `menuItemAppearanceCount`, not `menuItemCount`.
    const totalAppearances = body.stations.reduce((sum, station) => {
        return sum + Object.values(station.menu).reduce((s, items) => s + items.length, 0);
    }, 0);
    assert.equal(totalAppearances, cafe25Summary.menuItemAppearanceCount);

    // Distinct item IDs across the response equals the unique menu item count.
    const distinctItemIds = new Set<string>();
    for (const station of body.stations) {
        for (const items of Object.values(station.menu)) {
            for (const item of items) {
                distinctItemIds.add(item.id);
            }
        }
    }
    assert.equal(distinctItemIds.size, cafe25Summary.menuItemCount);
});

test('GET /api/dining/menu/cafe25 (canonical) returns array shape without version tag', async () => {
    const summary = ctx.server.getFixtureSummary();
    const cafe25Summary = summary.perCafe.get('cafe25');
    assert.ok(cafe25Summary);

    const stations = await fetchJson(
        `${baseUrl}/api/dining/menu/cafe25?date=${todayString}`,
        MenuResponseSchema,
    );

    assert.ok(Array.isArray(stations));
    assert.equal(stations.length, cafe25Summary.stationCount);
});

test('GET /api/dining/menu/cafe25 (canonical) returns object shape WITH version tag', async () => {
    const summary = ctx.server.getFixtureSummary();
    const cafe25Summary = summary.perCafe.get('cafe25');
    assert.ok(cafe25Summary);

    const body = await fetchJson(
        `${baseUrl}/api/dining/menu/cafe25?date=${todayString}`,
        CafeMenuResponseSchema,
        { versionTag: VERSION_TAG.menuRouteIsObjectInsteadOfArray },
    );

    assert.ok(!Array.isArray(body));
    assert.equal(body.isAvailable, true);
    assert.equal(body.stations.length, cafe25Summary.stationCount);
});

test('GET /api/dining/menu/{shutdown-cafe}/menu surfaces shutdown state', async () => {
    const body = await fetchJson(
        `${baseUrl}/api/dining/menu/${SHUTDOWN_CAFE_ID}/menu?date=${todayString}`,
        CafeMenuResponseSchema,
    );
    assert.ok(body.shutdownState, 'response should include shutdownState');
    assert.equal(body.shutdownState.message, SHUTDOWN_MESSAGE);
    assert.equal(body.shutdownState.type, 'full');
    assert.equal(body.shutdownState.isTemporary, false);
});

test('GET /api/dining/search returns a (possibly empty) result array', async () => {
    // Mock embeddings are deterministic but not semantically meaningful, and
    // the embeddings worker queue throttles processing to 1s/item, so the
    // index isn't fully populated by the time we query. We only assert the
    // endpoint shape here — full search behavior is exercised by unit tests.
    await fetchJson(`${baseUrl}/api/dining/search?q=burger`, SearchResponseSchema);
});
