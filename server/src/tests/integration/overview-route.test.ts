/**
 * Integration test for the menu-overview route — regression coverage for
 * 85a3fb4 ("fix double-id in overview registration").
 *
 * Before the fix, registerOverviewRoutes registered `/:id/overview` on the
 * `/:id`-prefixed view router, producing the unreachable composite path
 * `/api/dining/menu/:id/:id/overview`. Any client request to the real path
 * `/api/dining/menu/<viewId>/overview` 404'd.
 *
 * The fix changed the route literal to `/overview`, so the composed path
 * resolves to `/api/dining/menu/:id/overview`. This test asserts the route
 * is reachable end-to-end (not 404) for a valid view id, both with and
 * without a date query param.
 */

import { after, before, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { CafeMenuSession } from '../../worker/data/cafe/session/menu.js';
import { saveDailyMenuAsync } from '../../worker/data/cafe/job/storage.js';
import { DailyMenuStorageClient } from '../../worker/data/storage/clients/daily-menu/daily-menu.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';
import { fetchExpectStatus } from '../test-server/test-helpers.js';

const FAKE_NOW = new Date('2026-05-13T12:00:00Z'); // Wednesday
const CAFE_ID = 'cafe25';

let ctx: IntegrationTestContext;
let baseUrl: string;
let todayString: string;

before(async () => {
    mock.timers.enable({ apis: ['Date'], now: FAKE_NOW });
    todayString = DateUtil.toDateString(new Date());

    ctx = await createIntegrationTestContext();

    // Sync a single cafe so the overview has real daily data to assemble.
    const cafe = ALL_CAFES.find(c => c.id === CAFE_ID);
    assert.ok(cafe, `${CAFE_ID} should exist in ALL_CAFES`);

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

test('GET /api/dining/menu/:id/overview resolves (not 404) with a date param', async () => {
    // The expected path after the 85a3fb4 fix is `/api/dining/menu/:id/overview`.
    // Before the fix it was `/api/dining/menu/:id/:id/overview` and any request
    // here 404'd at the router.
    const res = await fetchExpectStatus(
        `${baseUrl}/api/dining/menu/${CAFE_ID}/overview?date=${todayString}`,
        200,
    );

    // Body should be JSON; we only need to confirm it parses and is non-empty
    // to prove the route hit a real handler (rather than the 404 middleware).
    const text = await res.text();
    assert.ok(text.length > 0, 'overview response body should not be empty');
    assert.doesNotThrow(() => JSON.parse(text), 'overview body should be valid JSON');
});

test('GET /api/dining/menu/:id/overview without a date still resolves (not 404)', async () => {
    // validateViewMenuAccessAsync returns '[]' with a 200 when no date is
    // supplied — important thing is the route resolves to a handler and
    // doesn't 404 because of the (formerly broken) registration path.
    await fetchExpectStatus(
        `${baseUrl}/api/dining/menu/${CAFE_ID}/overview`,
        200,
    );
});
