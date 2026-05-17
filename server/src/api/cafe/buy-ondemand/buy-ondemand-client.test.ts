/**
 * Tests for BuyOnDemandClient request shape & timeout behavior.
 *
 * Regression targets:
 *   86a9d6c — POST /sites/:contextId/:displayProfileId (pay config) and
 *             POST /sites/:tenantId/:contextId/concepts/:displayProfileId
 *             (station list / concept schedule) must include a
 *             `scheduleTime` field. Missing it caused prepare-cart to
 *             hang until the upstream gateway timed out.
 *   2e3482e — fetch is wrapped in AbortSignal.timeout(REQUEST_TIMEOUT_MS).
 *             Tested at integration level is impractical: the test client
 *             overrides requestAsync entirely, so the production timeout
 *             code path never runs. Documented + skipped below.
 */

import { after, before, beforeEach, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ICartItem } from '@msdining/common/models/cart';
import { CafeMenuSession } from '../session/menu.js';
import { CafeOrderSession } from '../session/order.js';
import { ICafe } from '../../../models/cafe.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../test-server/integration-test-context.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

beforeEach(() => {
    ctx.server.clearRequestLog();
    ctx.server.clearFailures();
});

const CAFE_ID = 'cafe25';
const CAFE: ICafe = { id: CAFE_ID, name: 'Test Cafe 25' };

const NONEXISTENT_CART_ITEM: ICartItem = {
    itemId:              'nonexistent-bod-client-item',
    quantity:            1,
    choicesByModifierId: new Map<string, Set<string>>(),
    specialInstructions: '',
};

interface ScheduleTimeShape {
    startTime: string;
    endTime: string;
}

function hasValidScheduleTime(body: unknown): body is { scheduleTime: ScheduleTimeShape } {
    if (body == null || typeof body !== 'object') return false;
    const candidate = (body as { scheduleTime?: unknown }).scheduleTime;
    if (candidate == null || typeof candidate !== 'object') return false;
    const st = candidate as { startTime?: unknown; endTime?: unknown };
    return typeof st.startTime === 'string'
        && st.startTime.length > 0
        && typeof st.endTime === 'string'
        && st.endTime.length > 0;
}

test('pay-config POST body includes scheduleTime (86a9d6c)', async () => {
    // populateCart triggers _fetchPayConfig (POST /sites/:contextId/:displayProfileId).
    // We don't need the cart to succeed — only need the request log entry.
    const session = await CafeOrderSession.createAsync(CAFE, [NONEXISTENT_CART_ITEM]);
    await assert.rejects(
        () => session.populateCart(),
        /Failed to find menu item|No concept schedule data|No concepts returned|Site data is empty/,
    );

    // Pay-config endpoint: POST /sites/<contextId>/<displayProfileId>
    // — exactly two segments after /sites/, distinguishing it from the
    // 3-segment /sites/<tenantId>/<contextId>/profitCenter/<id>.
    const payConfigPath = /^\/sites\/[^/]+\/[^/]+$/;
    const payConfigRequest = ctx.server.getRequestLog().find(entry =>
        entry.method === 'POST' && payConfigPath.test(entry.path),
    );
    assert.ok(payConfigRequest, 'expected a POST request to the pay-config endpoint');
    assert.ok(
        hasValidScheduleTime(payConfigRequest.body),
        `pay-config body must include a scheduleTime { startTime, endTime } object (got ${JSON.stringify(payConfigRequest.body)})`,
    );
});

test('concepts POST body includes scheduleTime (86a9d6c)', async () => {
    // Menu sync hits POST /sites/:tenantId/:contextId/concepts/:displayProfileId.
    // Default cafe25 fixtures are fine — we just need a successful concepts call.
    await CafeMenuSession.retrieveMenuAsync(CAFE, 0);

    const conceptsPath = /\/concepts\/[^/]+$/;
    const conceptsRequest = ctx.server.getRequestLog().find(entry =>
        entry.method === 'POST' && conceptsPath.test(entry.path),
    );
    assert.ok(conceptsRequest, 'expected a POST request to the concepts endpoint');
    assert.ok(
        hasValidScheduleTime(conceptsRequest.body),
        `concepts body must include a scheduleTime { startTime, endTime } object (got ${JSON.stringify(conceptsRequest.body)})`,
    );

    // Sanity: must also include scheduledDay alongside scheduleTime —
    // both were added together and both are required by the upstream.
    const body = conceptsRequest.body as { scheduledDay?: unknown };
    assert.equal(typeof body.scheduledDay, 'number', 'scheduledDay should be a number');
});

test('test server injectDelay does delay the response (sanity check for 2e3482e setup)', async () => {
    // Pre-flight check that the delay-injection plumbing actually works
    // for the real BoD client → test server path. We don't go anywhere
    // near REQUEST_TIMEOUT_MS — just enough to confirm setTimeout fires.
    const delayMs = 75;
    ctx.server.injectDelay({
        pathPattern: /\/concepts\//,
        delayMs,
        count:       1,
    });

    const start = Date.now();
    await CafeMenuSession.retrieveMenuAsync(CAFE, 0);
    const elapsed = Date.now() - start;

    assert.ok(
        elapsed >= delayMs,
        `expected at least ${delayMs}ms elapsed for a delayed concepts request (got ${elapsed}ms)`,
    );
});

test.skip(
    'slow fetch is aborted via AbortSignal.timeout (2e3482e) — not testable through TestBuyOnDemandClient',
    () => {
        // TestBuyOnDemandClient overrides requestAsync wholesale and calls
        // server.handleRequest() directly. That path never executes the
        // production REQUEST_TIMEOUT_MS / AbortSignal.timeout(...) wrapping
        // (which only lives in BuyOnDemandClient.requestAsync's fetch()
        // call). Testing the timeout meaningfully would require either:
        //   (a) plumbing a per-instance/per-test override for
        //       REQUEST_TIMEOUT_MS into BuyOnDemandClient (a production
        //       code change), or
        //   (b) spinning up a real HTTP listener that hangs, and routing
        //       fetch at it — but BoD URLs are derived from cafe.id via
        //       a hard-coded https://<id>.buy-ondemand.com template, so
        //       there's no clean redirect hook.
        // The default timeout (30s) is also far too long to wait for in
        // an in-process test. Skipping with this documentation until
        // either of the above changes lands.
    },
);
