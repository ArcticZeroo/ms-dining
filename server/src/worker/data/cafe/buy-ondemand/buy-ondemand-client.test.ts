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
import { IOrderItem } from '@msdining/common/models/order';
import { CafeMenuSession } from '../session/menu.js';
import { CafeOrderSession } from '../session/order.js';
import { ICafe } from '../../../../shared/models/cafe.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';

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

const NONEXISTENT_CART_ITEM: IOrderItem = {
    menuItemId:          'nonexistent-bod-client-item',
    quantity:            1,
    modifiers:           [],
    specialInstructions: '',
};

interface ScheduleTimeShape {
    startTime: string;
    endTime: string;
}

function hasValidScheduleTime(body: unknown): body is { scheduleTime: ScheduleTimeShape } {
    if (body == null || typeof body !== 'object') {
        return false;
    }
    const candidate = (body as { scheduleTime?: unknown }).scheduleTime;
    if (candidate == null || typeof candidate !== 'object') {
        return false;
    }
    const st = candidate as { startTime?: unknown; endTime?: unknown };
    return typeof st.startTime === 'string'
        && st.startTime.length > 0
        && typeof st.endTime === 'string'
        && st.endTime.length > 0;
}

test('pay-config POST body matches BoD wire shape: storeInfo present, scheduleTime absent', async () => {
    // BoD UI POSTs { storeInfo, scheduledDay: 0, isEasyMenuEnabled: false } to
    // /sites/{contextId}/{displayProfileId}. Sending a fixed scheduleTime
    // window (as we used to do, motivated by a long-ago hang at 86a9d6c)
    // appears to cause the server to scope subsequent /concepts calls to that
    // window — which on a cafe that closes before 11:15pm legitimately
    // returns no concepts and surfaces as CONCEPTS_NOT_AVAILABLE.
    const session = await CafeOrderSession.createAsync(CAFE, [NONEXISTENT_CART_ITEM]);
    await assert.rejects(
        () => session.populateCart(),
        /Failed to find menu item|No concept schedule data|No concepts returned|Site data is empty/,
    );

    // Pay-config endpoint: POST /sites/<contextId>/<displayProfileId> — two
    // segments after /sites/, distinct from the 3-segment profitCenter route.
    const payConfigPath = /^\/sites\/[^/]+\/[^/]+$/;
    const payConfigRequest = ctx.server.getRequestLog().find(entry =>
        entry.method === 'POST' && payConfigPath.test(entry.path),
    );
    assert.ok(payConfigRequest, 'expected a POST request to the pay-config endpoint');

    const body = payConfigRequest.body as Record<string, unknown> | undefined;
    assert.ok(body != null && typeof body === 'object', `expected JSON body, got ${typeof body}`);
    assert.equal(
        'scheduleTime' in body, false,
        `pay-config body must NOT include scheduleTime (got ${JSON.stringify(body)})`,
    );
    assert.ok(
        body.storeInfo != null && typeof body.storeInfo === 'object',
        `pay-config body must include storeInfo object (got ${JSON.stringify(body)})`,
    );
    assert.equal(body.scheduledDay, 0, 'pay-config body must include scheduledDay: 0');
    assert.equal(body.isEasyMenuEnabled, false, 'pay-config body must include isEasyMenuEnabled: false');
});

test('menu-sync concepts POST body STILL includes scheduleTime (86a9d6c)', async () => {
    // Menu sync (stations.ts) hits the same concepts endpoint but for
    // non-now menus (e.g. fetching today's 11am menu at 9am). Keeping
    // scheduleTime here is correct — only the ordering-path call at
    // order.ts:_fetchConceptSchedule should omit it.
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

test('ordering concepts POST body OMITS scheduleTime (ordering wants now())', async () => {
    // Companion to the menu-sync test above. The ordering flow always wants
    // "concepts available right now", which is what the server returns when
    // we omit scheduleTime — so we should not be sending one here.
    ctx.server.clearRequestLog();
    const session = await CafeOrderSession.createAsync(CAFE, [NONEXISTENT_CART_ITEM]);
    await assert.rejects(
        () => session.populateCart(),
        /Failed to find menu item|No concept schedule data|No concepts returned|Site data is empty/,
    );

    const conceptsPath = /\/concepts\/[^/]+$/;
    const conceptsRequest = ctx.server.getRequestLog().find(entry =>
        entry.method === 'POST' && conceptsPath.test(entry.path),
    );
    assert.ok(conceptsRequest, 'expected a POST to the concepts endpoint via the order flow');

    const body = conceptsRequest.body as Record<string, unknown> | undefined;
    assert.ok(body != null && typeof body === 'object');
    assert.equal(
        'scheduleTime' in body, false,
        `ordering /concepts body must NOT include scheduleTime (got ${JSON.stringify(body)})`,
    );
    assert.equal(body.scheduledDay, 0, 'ordering /concepts body must include scheduledDay: 0');
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
