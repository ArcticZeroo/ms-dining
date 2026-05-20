/**
 * Integration test for the /sitemap.xml route — regression coverage for
 * 56d8ed6 ("fix sitemap 404").
 *
 * Before the fix, the route set `ctx.respond = false` and tried to pipe the
 * SitemapStream directly to ctx.res. With Koa's response pipeline that path
 * collapsed to a 404 with no body. The fix awaits streamToPromise() and
 * assigns the buffered XML to ctx.body with `ctx.type = 'xml'`.
 *
 * This test boots the real app, hits /sitemap.xml through HTTP, and asserts
 * the response is a 200 XML document containing the expected <urlset> root.
 */

import { after, before, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { CafeMenuSession } from '../../api/cafe/session/menu.js';
import { saveDailyMenuAsync } from '../../api/cafe/job/storage.js';
import { DailyMenuStorageClient } from '../../api/storage/clients/daily-menu.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../test-server/integration-test-context.js';
import { fetchExpectStatus } from '../../test-server/test-helpers.js';

// Pinned weekday so any date-sensitive code path observes a stable clock.
const FAKE_NOW = new Date('2026-05-13T12:00:00Z'); // Wednesday
const CAFE_ID = 'cafe25';

let ctx: IntegrationTestContext;
let baseUrl: string;

before(async () => {
    mock.timers.enable({ apis: ['Date'], now: FAKE_NOW });

    ctx = await createIntegrationTestContext();
    ctx.installServices();

    // Sync a single cafe end-to-end so the DB isn't empty when /sitemap.xml
    // is requested (mirrors the smoke test setup). The sitemap itself is
    // driven by static CAFE_GROUP_LIST plus SearchQueryClient, so it should
    // render even without sync — but having real menu data exercised here
    // protects against future changes that start pulling from the DB.
    const cafe = ALL_CAFES.find(c => c.id === CAFE_ID);
    assert.ok(cafe, `${CAFE_ID} should exist in ALL_CAFES`);

    const todayString = DateUtil.toDateString(new Date());
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

test('GET /sitemap.xml returns 200 with an XML body containing <urlset>', async () => {
    ctx.installServices();
    const res = await fetchExpectStatus(`${baseUrl}/sitemap.xml`, 200);

    const contentType = res.headers.get('content-type') ?? '';
    assert.ok(
        contentType.toLowerCase().includes('xml'),
        `Content-Type should contain "xml" (got: "${contentType}")`,
    );

    const body = await res.text();
    assert.ok(body.length > 0, 'sitemap body should not be empty');
    assert.ok(
        body.includes('<urlset'),
        `sitemap body should contain a <urlset> root element (body starts with: ${body.slice(0, 200)})`,
    );

    // Sanity check that the static URLs the sitemap always emits are in the
    // body — confirms we got a real generated document, not just a stub.
    assert.ok(body.includes('/menu/'), 'sitemap should include per-cafe /menu/ URLs');
});
