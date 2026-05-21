/**
 * Tests for CafeOrderSession ordering-context retrieval.
 *
 * The relevant code is private, so we drive it through the public
 * populateCart() entry point. populateCart calls
 * _runStages(notStarted, cb) which:
 *   1. Awaits _retrieveOrderingContextAsync() (where the profit-center
 *      lookup happens) — the path under test.
 *   2. Then runs cb, which eventually calls _addItemToCart and is
 *      expected to throw here because we don't seed the DB with the
 *      cart item. The throw is caught with assert.rejects, and we then
 *      inspect ctx.server.getRequestLog() to verify the profit-center
 *      request was issued correctly BEFORE the failure.
 *
 * Regression target: 22eeffc — profit center name 404 (lookup used the
 * wrong identifier).
 */

import { after, before, beforeEach, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ICartItem } from '@msdining/common/models/cart';
import { CafeOrderSession } from './order.js';
import { ICafe } from '../../../../shared/models/cafe.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
    ctx.installServices();
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

// A cart item whose itemId doesn't exist in the local DB. This makes
// _populateCart throw with "Failed to find menu item ..." once the
// ordering context (the thing under test) has already been fetched.
const NONEXISTENT_CART_ITEM: ICartItem = {
    itemId:              'nonexistent-item-for-order-test',
    quantity:            1,
    choicesByModifierId: new Map<string, Set<string>>(),
    specialInstructions: '',
};

interface ProfitCenterRequestLookup {
    found: boolean;
    profitCenterIdInUrl: string | null;
    tenantIdInUrl: string | null;
    contextIdInUrl: string | null;
}

function findProfitCenterRequest(requestLog: ReturnType<typeof ctx.server.getRequestLog>): ProfitCenterRequestLookup {
    // Real URL shape: /sites/<tenantId>/<contextId>/profitCenter/<profitCenterId>
    const match = /^\/sites\/([^/]+)\/([^/]+)\/profitCenter\/([^/]+)$/;
    for (const entry of requestLog) {
        const m = match.exec(entry.path);
        if (m && entry.method === 'GET') {
            return {
                found:               true,
                tenantIdInUrl:       m[1] ?? null,
                contextIdInUrl:      m[2] ?? null,
                profitCenterIdInUrl: m[3] ?? null,
            };
        }
    }
    return { found: false, tenantIdInUrl: null, contextIdInUrl: null, profitCenterIdInUrl: null };
}

test('profit center lookup uses the profit-center ID from site data, not the tenant/context ID', async () => {
    ctx.installServices();
    // Distinct values for tenantId, contextId, and profitCenterId so we
    // can prove the right one is being passed into the URL.
    const distinctProfitCenterId = '22eeffc-profit-center-XYZ-unique';
    ctx.server.setFixture(CAFE_ID, 'site-data', [
        {
            storePriceLevel: 'test-price-level-001',
            displayOptions:  {
                onDemandTerminalId: 'test-terminal-001',
                onDemandEmployeeId: 'test-employee-001',
                'profit-center-id': distinctProfitCenterId,
                'check-type':       'test-check-type-001',
            },
            siteStoreInfo: {
                businessContextId: 'test-context-001',
                tenantId:          'test-tenant-001',
            },
        },
    ]);

    const session = await CafeOrderSession.createAsync(CAFE, [NONEXISTENT_CART_ITEM]);

    // populateCart will reject when _addItemToCart can't find the local
    // menu item — but by then the ordering-context fetch (the thing under
    // test) is already in the request log.
    await assert.rejects(
        () => session.populateCart(),
        /Failed to find menu item|No concept schedule data|No concepts returned/,
        'populateCart should reject downstream of the ordering-context fetch',
    );

    const lookup = findProfitCenterRequest(ctx.server.getRequestLog());
    assert.ok(lookup.found, 'expected a GET request to /sites/.../profitCenter/<id>');
    assert.equal(
        lookup.profitCenterIdInUrl,
        distinctProfitCenterId,
        'profit-center ID in URL must come from site-data displayOptions',
    );
    // The cafe25 fixture's config sets tenantID='tenant-cafe25' and
    // contextID='ctx-cafe25-6965'; the URL must use those (from client
    // config) — NOT the profit-center ID and NOT the siteStoreInfo IDs.
    assert.equal(lookup.tenantIdInUrl, 'tenant-cafe25', 'tenant in URL should be the cafe config tenantId');
    assert.equal(lookup.contextIdInUrl, 'ctx-cafe25-6965', 'context in URL should be the cafe config contextId');
});

test('ordering context still resolves when profit-center ID differs from tenant/context IDs', async () => {
    ctx.installServices();
    // Same idea as the previous test but emphasizes that the resolution
    // works even when there is zero overlap between profit-center ID,
    // tenant ID, and context ID.
    const profitCenterId = 'PC-completely-different-value-789';
    ctx.server.setFixture(CAFE_ID, 'site-data', [
        {
            storePriceLevel: 'sl-1',
            displayOptions:  {
                onDemandTerminalId: 'terminal-1',
                onDemandEmployeeId: 'employee-1',
                'profit-center-id': profitCenterId,
            },
            siteStoreInfo: {},
        },
    ]);

    const session = await CafeOrderSession.createAsync(CAFE, [NONEXISTENT_CART_ITEM]);

    await assert.rejects(
        () => session.populateCart(),
        /Failed to find menu item|No concept schedule data|No concepts returned/,
    );

    const lookup = findProfitCenterRequest(ctx.server.getRequestLog());
    assert.ok(lookup.found, 'profit-center request should have been issued');
    assert.equal(lookup.profitCenterIdInUrl, profitCenterId);
    assert.notEqual(lookup.tenantIdInUrl, profitCenterId);
    assert.notEqual(lookup.contextIdInUrl, profitCenterId);
});

test('populateCart surfaces a clear error when site data is missing', async () => {
    ctx.installServices();
    // Empty array -> _fetchSiteData throws "Site data is empty!" before
    // the profit-center lookup is even attempted.
    ctx.server.setFixture(CAFE_ID, 'site-data', []);

    const session = await CafeOrderSession.createAsync(CAFE, [NONEXISTENT_CART_ITEM]);

    await assert.rejects(
        () => session.populateCart(),
        /Site data is empty/,
        'expected the "Site data is empty!" error to bubble up',
    );

    // Sanity check: with no site data, the profit-center request must NOT
    // have been issued (there's no ID to look up).
    const lookup = findProfitCenterRequest(ctx.server.getRequestLog());
    assert.equal(lookup.found, false, 'profit-center request should not be issued when site data is empty');
});
