/**
 * Integration test for the "don't return empty concepts" behavior —
 * regression coverage for 916140f.
 *
 * Before the fix, GET /api/dining/menu/:cafeId/menu could return a station
 * whose categories all had zero items. Real BoD responses occasionally
 * include an upstream-empty concept (e.g. a station scheduled for the day
 * but with no items configured), and surfacing it to the client produced a
 * visibly-empty section.
 *
 * Setup:
 *   - Take the real cafe25 stations fixture (5 stations).
 *   - Mutate the FIRST station so every category in every menu has
 *     `items = []`. Other 4 stations keep their fixture data unchanged.
 *   - Drive a single-cafe sync through the production CafeMenuSession +
 *     saveDailyMenuAsync path so the empty station is treated exactly the
 *     way a real BoD-empty concept would be.
 *
 * Assertions:
 *   - The emptied station's id is NOT present in the response.
 *   - All 4 other stations' ids ARE present.
 *   - Every returned station has at least one category with at least one
 *     item (no "ghost" empty sections).
 */

import { after, before, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { CafeMenuResponseSchema } from '@msdining/common/models/http';
import { CafeMenuSession } from '../../worker/data/cafe/session/menu.js';
import { saveDailyMenuAsync } from '../../worker/data/cafe/job/storage.js';
import { DailyMenuStorageClient } from '../../worker/data/storage/clients/daily-menu/daily-menu.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';
import { fetchJson } from '../test-server/test-helpers.js';

const FAKE_NOW = new Date('2026-05-13T12:00:00Z'); // Wednesday
const CAFE_ID = 'cafe25';

interface StationFixtureCategory {
    categoryId: string;
    name: string;
    items: string[];
    subCategories?: Array<{ subCategoryId: string; name: string; items: string[] }>;
}

interface StationFixtureMenu {
    id: string;
    name: string;
    categories: StationFixtureCategory[];
    lastUpdateTime: string;
}

interface StationFixture {
    id: string;
    name: string;
    menus: StationFixtureMenu[];
    [extra: string]: unknown;
}

let ctx: IntegrationTestContext;
let baseUrl: string;
let todayString: string;
let emptiedStationId: string;
let remainingStationIds: Set<string>;

before(async () => {
    mock.timers.enable({ apis: ['Date'], now: FAKE_NOW });
    todayString = DateUtil.toDateString(new Date());

    ctx = await createIntegrationTestContext();

    const cafe = ALL_CAFES.find(c => c.id === CAFE_ID);
    assert.ok(cafe, `${CAFE_ID} should exist in ALL_CAFES`);

    const originalStations = ctx.server.state.getFixture<StationFixture[]>(CAFE_ID, 'stations');
    assert.ok(originalStations && originalStations.length >= 2,
        `${CAFE_ID} fixture should have at least 2 stations to allow one-empty-one-populated`);

    const [firstStation, ...rest] = originalStations;
    assert.ok(firstStation, 'expected at least one station in the fixture');
    emptiedStationId = firstStation.id;
    remainingStationIds = new Set(rest.map(s => s.id));

    // Deep-clone first station and zero out every category's items. The other
    // stations are passed through unchanged.
    const emptiedStation: StationFixture = {
        ...firstStation,
        menus: firstStation.menus.map(menu => ({
            ...menu,
            categories: menu.categories.map(category => {
                const next: StationFixtureCategory = { ...category, items: [] };
                if (category.subCategories) {
                    next.subCategories = category.subCategories.map(sub => ({ ...sub, items: [] }));
                }
                return next;
            }),
        })),
    };
    ctx.server.setFixture(CAFE_ID, 'stations', [emptiedStation, ...rest]);

    // Drive the real production sync code path for this one cafe. Sync runs
    // BEFORE starting the webserver — matching the smoke/overview-route
    // test pattern — to avoid a Windows-specific libuv assertion at exit
    // that triggers when the webserver is started before the embeddings
    // worker has a chance to enqueue its initial batch of work.
    const result = await CafeMenuSession.retrieveMenuAsync(cafe, 0);
    await DailyMenuStorageClient.upsertDailyCafeAsync(cafe.id, todayString, {
        isAvailable:         true,
        shutdownMessageHash: null,
    });
    await saveDailyMenuAsync({
        cafe,
        dateString:                todayString,
        isAvailable:               true,
        stations:                  result.stations,
        shouldUpdateExistingItems: true,
    });

    baseUrl = await ctx.startWebserver();
}, { timeout: 60_000 });

after(async () => {
    // Yield long enough for worker threads (embeddings, thumbnail) to drain
    // any in-flight requests before tearing down. Without this, Node's
    // --test-force-exit can fire `!(handle->flags & UV_HANDLE_CLOSING)` on
    // Windows when the worker IPC handle is mid-operation as the parent
    // closes it.
    await new Promise(resolve => setTimeout(resolve, 1000));
    await ctx.cleanup();
    mock.timers.reset();
});

test('GET /api/dining/menu/:cafeId/menu omits stations with all-empty categories', async () => {
    const body = await fetchJson(
        `${baseUrl}/api/dining/menu/${CAFE_ID}/menu?date=${todayString}`,
        CafeMenuResponseSchema,
    );

    assert.equal(body.isAvailable, true);

    const returnedStationIds = new Set(body.stations.map(s => s.id));
    assert.ok(
        !returnedStationIds.has(emptiedStationId),
        `emptied station ${emptiedStationId} should be omitted (got stations: ${[...returnedStationIds].join(', ')})`,
    );

    for (const remainingId of remainingStationIds) {
        assert.ok(
            returnedStationIds.has(remainingId),
            `non-empty station ${remainingId} should still be present`,
        );
    }
});

test('every returned station has at least one category with at least one item', async () => {
    const body = await fetchJson(
        `${baseUrl}/api/dining/menu/${CAFE_ID}/menu?date=${todayString}`,
        CafeMenuResponseSchema,
    );

    for (const station of body.stations) {
        const categoryItemCounts = Object.values(station.menu).map(items => items.length);
        assert.ok(
            categoryItemCounts.some(n => n > 0),
            `station ${station.id} (${station.name}) was returned with only empty categories: ${JSON.stringify(station.menu)}`,
        );
    }
});
