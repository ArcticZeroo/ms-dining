/**
 * Translation of BoD error codes into user-facing messages.
 *
 * Verifies that when a BoD request fails with a JSON `{ message: <code> }`
 * body, our `BuyOnDemandClient` (constructed with `translateErrors: true`)
 * fetches the i18n map from /api/translation/..., looks up the code, and
 * throws a `BuyOnDemandError` carrying the translated user-facing message.
 *
 * Most cases drive the BoD client directly to keep the tests focused on the
 * translation pipeline. The end-to-end case at the bottom drives the full
 * order flow through the Koa webserver to prove the middleware surfaces
 * the translated message as a 502 JSON body the client can render.
 */

import { after, before, beforeEach, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { CafeMenuSession } from '../../worker/data/cafe/session/menu.js';
import { saveDailyMenuAsync } from '../../worker/data/cafe/job/storage.js';
import { DailyMenuStorageClient } from '../../worker/data/storage/clients/daily-menu/daily-menu.js';
import { BuyOnDemandClient } from '../../worker/data/cafe/buy-ondemand/buy-ondemand-client.js';
import { BuyOnDemandError } from '../../worker/data/cafe/buy-ondemand/buy-ondemand-error.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import { createBuyOnDemandClient } from '../../main/services/registry.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';

const CAFE_ID = 'cafe25';
// Pinned weekday so weekend-skip logic doesn't short-circuit during sync.
const FAKE_NOW = new Date('2026-05-13T12:00:00Z');

let ctx: IntegrationTestContext;
let baseUrl: string;
let todayString: string;
let testUserId: string;

before(async () => {
    mock.timers.enable({ apis: ['Date'], now: FAKE_NOW });
    todayString = DateUtil.toDateString(new Date());

    ctx = await createIntegrationTestContext();

    const testUser = await ctx.createTestUser();
    testUserId = testUser.id;

    const cafe = ALL_CAFES.find(c => c.id === CAFE_ID);
    assert.ok(cafe, `${CAFE_ID} should exist in ALL_CAFES`);

    // Single-cafe sync — enough to satisfy /prepare/cart validation
    // (CafeStorageClient.retrieveCafeAsync + DailyMenuStorageClient lookup).
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
    // Tests that exercise menu sync need a small drain for the embeddings
    // worker IPC before cleanup to dodge the Windows libuv UV_HANDLE_CLOSING
    // panic under --test-force-exit.
    await new Promise(resolve => setTimeout(resolve, 1000));
    await ctx.cleanup();
    mock.timers.reset();
});

beforeEach(() => {
    // Reset any per-test injected failures and translation overrides so
    // tests don't leak state into each other.
    ctx.server.clearFailures();
    ctx.server.resetTranslations();
});

const cafe = () => {
    const found = ALL_CAFES.find(c => c.id === CAFE_ID);
    assert.ok(found, `${CAFE_ID} should exist`);
    return found;
};

async function buildTranslatingClient(): Promise<BuyOnDemandClient> {
    return createBuyOnDemandClient(cafe(), { translateErrors: true });
}

// ─── Direct-client translation pipeline ─────────────────────────────────

test('translates a real BoD error code (CONCEPTS_NOT_AVAILABLE) via the default fixture', async () => {
    const client = await buildTranslatingClient();

    ctx.server.injectBoDError({
        method:      'POST',
        pathPattern: /\/processPaymentAndClosedOrder$/,
        code:        'CONCEPTS_NOT_AVAILABLE',
    });

    const err = await assertRejects(
        () => client.requestAsync(`/order/t/c/orderId/abc/processPaymentAndClosedOrder`, { method: 'POST' }),
    );

    assert.ok(err instanceof BuyOnDemandError, `expected BuyOnDemandError, got ${err?.constructor?.name}: ${err}`);
    assert.equal(err.rawCode, 'CONCEPTS_NOT_AVAILABLE');
    assert.equal(err.httpStatus, 400);
    assert.match(err.userMessage, /Order cannot be processed/i);
    // super(userMessage) — `.message` is the translated string so generic
    // logging surfaces useful info without callers needing to know the type.
    assert.equal(err.message, err.userMessage);
});

test('translates a custom code seeded via setTranslation', async () => {
    ctx.server.setTranslation('SOMETHING_BROKE', 'Something specific broke for the test.');

    const client = await buildTranslatingClient();

    ctx.server.injectBoDError({
        method:      'POST',
        pathPattern: /\/orders$/,
        code:        'SOMETHING_BROKE',
        status:      409,
    });

    const err = await assertRejects(
        () => client.requestAsync(`/order/t/c/orders`, { method: 'POST' }),
    );

    assert.ok(err instanceof BuyOnDemandError);
    assert.equal(err.rawCode, 'SOMETHING_BROKE');
    assert.equal(err.httpStatus, 409);
    assert.equal(err.userMessage, 'Something specific broke for the test.');
});

test('translation persists across multiple requests on the same client (cache works)', async () => {
    ctx.server.setTranslation('FLAKY_THING', 'The flaky thing happened.');

    const client = await buildTranslatingClient();

    ctx.server.injectBoDError({
        pathPattern: /\/anything$/,
        code:        'FLAKY_THING',
        count:       2,
    });

    const before = ctx.server.getRequestLog().filter(r => r.path.startsWith('/translation/')).length;

    await assertRejects(() => client.requestAsync('/anything', { method: 'GET' }));
    await assertRejects(() => client.requestAsync('/anything', { method: 'GET' }));

    const after = ctx.server.getRequestLog().filter(r => r.path.startsWith('/translation/')).length;
    // Translation cache covers both `core` + `domain-<host>` namespaces, so a
    // single lazy fetch hits two endpoints. Hitting two errors should not
    // double that count.
    const translationFetches = after - before;
    assert.equal(
        translationFetches,
        2,
        `expected exactly 2 translation fetches (one core + one domain, cached), got ${translationFetches}`,
    );
});

test('falls back to the raw code when translation fetch fails', async () => {
    ctx.server.injectFailure({
        method:      'GET',
        pathPattern: /\/translation\//,
        statusCode:  500,
        body:        'translation backend down',
    });
    ctx.server.injectBoDError({
        method:      'POST',
        pathPattern: /\/processPaymentAndClosedOrder$/,
        code:        'OBSCURE_CODE',
    });

    const client = await buildTranslatingClient();

    const err = await assertRejects(
        () => client.requestAsync(`/order/t/c/orderId/abc/processPaymentAndClosedOrder`, { method: 'POST' }),
    );

    assert.ok(err instanceof BuyOnDemandError, `expected BuyOnDemandError, got ${err}`);
    assert.equal(err.rawCode, 'OBSCURE_CODE');
    // No translation map available → user message degrades to the raw code,
    // strictly better than failing the whole request when ordering already
    // hit an upstream error.
    assert.equal(err.userMessage, 'OBSCURE_CODE');
});

test('translation map miss surfaces the raw code as the user message', async () => {
    // Default fixture is in place; CODE_NOT_IN_FIXTURE is not.
    const client = await buildTranslatingClient();

    ctx.server.injectBoDError({
        method:      'POST',
        pathPattern: /\/orders$/,
        code:        'CODE_NOT_IN_FIXTURE',
    });

    const err = await assertRejects(
        () => client.requestAsync(`/order/t/c/orders`, { method: 'POST' }),
    );

    assert.ok(err instanceof BuyOnDemandError);
    assert.equal(err.rawCode, 'CODE_NOT_IN_FIXTURE');
    assert.equal(err.userMessage, 'CODE_NOT_IN_FIXTURE');
});

test('non-translatable response body (not BoD-shape) does NOT become a BuyOnDemandError', async () => {
    ctx.server.injectFailure({
        method:      'POST',
        pathPattern: /\/orders$/,
        statusCode:  500,
        body:        '<html><body>upstream proxy 502</body></html>',
        headers:     { 'content-type': 'text/html' },
    });

    const client = await buildTranslatingClient();

    const err = await assertRejects(
        () => client.requestAsync(`/order/t/c/orders`, { method: 'POST' }),
    );

    assert.ok(!(err instanceof BuyOnDemandError), 'should be a plain Error, not BuyOnDemandError');
    assert.match(err.message, /failed \(500\)/);
    assert.match(err.message, /upstream proxy 502/);
});

test('JSON body without a `message` field falls through to the generic error', async () => {
    ctx.server.injectFailure({
        method:      'POST',
        pathPattern: /\/orders$/,
        statusCode:  400,
        body:        JSON.stringify({ statusCode: 400, error: 'Bad Request' }),
        headers:     { 'content-type': 'application/json' },
    });

    const client = await buildTranslatingClient();

    const err = await assertRejects(
        () => client.requestAsync(`/order/t/c/orders`, { method: 'POST' }),
    );

    assert.ok(!(err instanceof BuyOnDemandError));
    assert.match(err.message, /failed \(400\)/);
});

test('translateErrors:false (default) preserves the legacy generic error', async () => {
    const client = await createBuyOnDemandClient(cafe());   // no translateErrors

    ctx.server.injectBoDError({
        method:      'POST',
        pathPattern: /\/orders$/,
        code:        'CONCEPTS_NOT_AVAILABLE',
    });

    const err = await assertRejects(
        () => client.requestAsync(`/order/t/c/orders`, { method: 'POST' }),
    );

    assert.ok(!(err instanceof BuyOnDemandError));
    assert.match(err.message, /Response failed with status: 400/);
});

// ─── End-to-end via the Koa webserver ──────────────────────────────────

test('webserver: order failure surfaces as 502 with translated message + code', async () => {
    ctx.server.setTranslation('STATION_GONE', 'That station is no longer available.');

    // We need a real menu item to build a valid prepare-payment request.
    const menu = await DailyMenuStorageClient.retrieveDailyMenuAsync(CAFE_ID, todayString);
    assert.ok(menu.length > 0, 'sanity: menu should have stations');
    const firstStation = menu[0]!;
    const firstItemId = Array.from(firstStation.menuItemsById.keys())[0];
    assert.ok(firstItemId, 'sanity: first station should have at least one item');

    const payload = {
        items: [
            { menuItemId: firstItemId, quantity: 1, modifiers: [] },
        ],
    };

    // Inject the failure on the addToCart endpoint — fails immediately during
    // prepare-payment's session creation, no need to drive the full payment flow.
    ctx.server.injectBoDError({
        method:      'POST',
        pathPattern: /\/orders$/,
        code:        'STATION_GONE',
    });

    const res = await ctx.fetchAs(testUserId, `${baseUrl}/api/dining/order/cafes/${CAFE_ID}/prepare-payment`, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify(payload),
    });

    assert.equal(res.status, 502, `expected 502 from BoD-error mapping middleware, got ${res.status}`);
    const body = await res.json() as { message: string; code: string };
    assert.equal(body.code, 'STATION_GONE');
    assert.equal(body.message, 'That station is no longer available.');
});

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Awaits the given promise-returning function and returns the rejection. Fails
 * the test if the promise resolves. Lets us inspect the actual error object
 * (instanceof, properties) without the assertion noise of node:assert.rejects.
 */
async function assertRejects(fn: () => Promise<unknown>): Promise<Error & Record<string, unknown>> {
    try {
        await fn();
    } catch (err) {
        return err as Error & Record<string, unknown>;
    }
    assert.fail('expected the promise to reject, but it resolved');
}
