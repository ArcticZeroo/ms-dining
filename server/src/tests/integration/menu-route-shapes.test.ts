/**
 * Verifies the two cafe-menu route shapes:
 *
 *   GET /api/dining/menu/:cafeId           ← canonical, going forward
 *     - No version tag       → returns MenuResponse (Array<IStationDTO>)
 *     - menuRouteIsObjectInsteadOfArray version tag → returns ICafeMenuResponse (object)
 *
 *   GET /api/dining/menu/:cafeId/menu      ← legacy, slated for deprecation
 *     - Always returns ICafeMenuResponse (object), regardless of version tag
 *
 * Catches the recent regression where the array fallback was applied
 * unconditionally to both routes, breaking the "always-object" guarantee
 * of the legacy /menu/:cafeId/menu endpoint. Also catches the inverse: a
 * future regression that drops the version tag check on the canonical
 * route would silently break old clients still sending no tag.
 */

import { after, before, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { VERSION_TAG } from '@msdining/common/constants/versions';
import { CafeMenuResponseSchema, MenuResponseSchema } from '@msdining/common/models/http';
import { CafeMenuSession } from '../../api/cafe/session/menu.js';
import { saveDailyMenuAsync } from '../../api/cafe/job/storage.js';
import { DailyMenuStorageClient } from '../../api/storage/clients/daily-menu.js';
import { ALL_CAFES } from '../../constants/cafes.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../test-server/integration-test-context.js';
import { fetchJson } from '../../test-server/test-helpers.js';

const CAFE_ID = 'cafe25';
// Pinned weekday so weekend-skip logic doesn't short-circuit.
const FAKE_NOW = new Date('2026-05-13T12:00:00Z');

let ctx: IntegrationTestContext;
let baseUrl: string;
let todayString: string;

before(async () => {
    mock.timers.enable({ apis: ['Date'], now: FAKE_NOW });
    todayString = DateUtil.toDateString(new Date());

    ctx = await createIntegrationTestContext();

    const cafe = ALL_CAFES.find(c => c.id === CAFE_ID);
    assert.ok(cafe, `${CAFE_ID} should exist in ALL_CAFES`);

    // Single-cafe sync — faster than performMenuBootTasks() and we only
    // need cafe25's menu for these tests.
    const result = await CafeMenuSession.retrieveMenuAsync(cafe, 0);
    assert.ok(result.stations.length > 0, 'sanity: discovery returned stations');

    await DailyMenuStorageClient.upsertDailyCafeAsync(cafe.id, todayString, {
        isAvailable: true,
        shutdownMessageHash: null,
    });
    await saveDailyMenuAsync({
        cafe,
        dateString: todayString,
        isAvailable: true,
        stations: result.stations,
        shouldUpdateExistingItems: true,
    });

    baseUrl = await ctx.startWebserver();
}, { timeout: 60_000 });

after(async () => {
    // Tests in this file touch the embeddings worker via sync; give the
    // worker IPC a moment to settle before tearing down to dodge Windows
    // libuv UV_HANDLE_CLOSING panic under --test-force-exit.
    await new Promise(resolve => setTimeout(resolve, 1000));
    await ctx.cleanup();
    mock.timers.reset();
});

const canonicalUrl = () => `${baseUrl}/api/dining/menu/${CAFE_ID}?date=${todayString}`;
const legacyUrl = () => `${baseUrl}/api/dining/menu/${CAFE_ID}/menu?date=${todayString}`;

// ── Canonical route: /api/dining/menu/:cafeId ─────────────────────────

test('canonical /menu/:cafeId without version tag returns the array shape', async () => {
    const body = await fetchJson(canonicalUrl(), MenuResponseSchema);
    assert.ok(Array.isArray(body), 'response must be a station array');
    assert.ok(body.length > 0, 'should have at least one station');
});

test('canonical /menu/:cafeId with menuRouteIsObjectInsteadOfArray tag returns the object shape', async () => {
    const body = await fetchJson(
        canonicalUrl(),
        CafeMenuResponseSchema,
        { versionTag: VERSION_TAG.menuRouteIsObjectInsteadOfArray },
    );
    assert.equal(typeof body, 'object');
    assert.ok(!Array.isArray(body), 'response must NOT be an array when the version tag is sent');
    assert.equal(body.isAvailable, true);
    assert.ok(body.stations.length > 0);
});

test('canonical /menu/:cafeId with a lower version tag still returns the array shape', async () => {
    // Send any tag below `menuRouteIsObjectInsteadOfArray`. The route
    // should treat this as "old client" and serve the array.
    const lowerTag = VERSION_TAG.menuRouteIsObjectInsteadOfArray - 1;
    if (lowerTag < 0) {
        // No tag below it exists yet (impossible if `unknown=0` is reserved,
        // but guard anyway so the test is meaningful as more tags are deprecated).
        return;
    }
    const body = await fetchJson(canonicalUrl(), MenuResponseSchema, { versionTag: lowerTag });
    assert.ok(Array.isArray(body));
});

// ── Legacy route: /api/dining/menu/:cafeId/menu ───────────────────────

test('legacy /menu/:cafeId/menu always returns the object shape, even without a version tag', async () => {
    // Regression: a recent change applied the array-fallback to BOTH routes,
    // which broke /menu/:cafeId/menu for old clients (the schema didn't match).
    // The fix gates the fallback to the canonical route only — this test
    // verifies the legacy route is unconditional.
    const body = await fetchJson(legacyUrl(), CafeMenuResponseSchema);
    assert.equal(typeof body, 'object');
    assert.ok(!Array.isArray(body));
    assert.equal(body.isAvailable, true);
});

test('legacy /menu/:cafeId/menu returns the object shape with the version tag too', async () => {
    const body = await fetchJson(
        legacyUrl(),
        CafeMenuResponseSchema,
        { versionTag: VERSION_TAG.menuRouteIsObjectInsteadOfArray },
    );
    assert.equal(typeof body, 'object');
    assert.ok(!Array.isArray(body));
});

// ── Consistency: both routes should describe the same menu ────────────

test('canonical (with tag) and legacy route return equivalent station data for the same cafe + date', async () => {
    const canonicalObj = await fetchJson(
        canonicalUrl(),
        CafeMenuResponseSchema,
        { versionTag: VERSION_TAG.menuRouteIsObjectInsteadOfArray },
    );
    const legacyObj = await fetchJson(legacyUrl(), CafeMenuResponseSchema);

    // Station identity + count must match across the two routes — a
    // regression that diverged the two serialization paths would fail here.
    const canonicalStationIds = canonicalObj.stations.map(s => s.id).sort();
    const legacyStationIds = legacyObj.stations.map(s => s.id).sort();
    assert.deepEqual(canonicalStationIds, legacyStationIds);
});
