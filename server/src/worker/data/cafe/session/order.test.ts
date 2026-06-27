/**
 * Tests for ordering-context retrieval (site data + profit-center lookup).
 *
 * We drive requestDailyOrderingContextAsync() directly — it is the function
 * that issues the site-data GET, pay-config POST, and profit-center GET that
 * the ordering flow depends on. Driving it directly (rather than through
 * CafeOrderSession.createAsync/populateCart) keeps the test focused on the
 * profit-center resolution under test, avoids coupling to menu-item seeding,
 * and sidesteps the per-cafe ordering-context cache (retrieveDailyOrderingContext)
 * so each test re-issues the requests it inspects.
 *
 * Regression target: 22eeffc — profit center name 404 (lookup used the
 * wrong identifier).
 */

import { after, before, beforeEach, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ICafe } from '../../../../shared/models/cafe.js';
import { createBuyOnDemandClient } from '../../../../shared/services/registry.js';
import { requestDailyOrderingContextAsync } from '../buy-ondemand/ordering/ordering-context.js';
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

const createClient = () =>
    createBuyOnDemandClient(CAFE, { enableHar: true, translateErrors: true });

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
        const pathMatch = match.exec(entry.path);
        if (pathMatch && entry.method === 'GET') {
            return {
                found:               true,
                tenantIdInUrl:       pathMatch[1] ?? null,
                contextIdInUrl:      pathMatch[2] ?? null,
                profitCenterIdInUrl: pathMatch[3] ?? null,
            };
        }
    }
    return { found: false, tenantIdInUrl: null, contextIdInUrl: null, profitCenterIdInUrl: null };
}

test('profit center lookup uses the profit-center ID from site data, not the tenant/context ID', async () => {
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

    await requestDailyOrderingContextAsync(await createClient());

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

    await requestDailyOrderingContextAsync(await createClient());

    const lookup = findProfitCenterRequest(ctx.server.getRequestLog());
    assert.ok(lookup.found, 'profit-center request should have been issued');
    assert.equal(lookup.profitCenterIdInUrl, profitCenterId);
    assert.notEqual(lookup.tenantIdInUrl, profitCenterId);
    assert.notEqual(lookup.contextIdInUrl, profitCenterId);
});

test('ordering-context fetch surfaces a clear error when site data is missing', async () => {
    // Empty array -> retrieveSiteData throws "No site data found for tenant ..."
    // before the profit-center lookup is even attempted.
    ctx.server.setFixture(CAFE_ID, 'site-data', []);

    const client = await createClient();
    await assert.rejects(
        () => requestDailyOrderingContextAsync(client),
        /No site data found for tenant/,
        'expected the empty-site-data error to bubble up',
    );

    // Sanity check: with no site data, the profit-center request must NOT
    // have been issued (there's no ID to look up).
    const lookup = findProfitCenterRequest(ctx.server.getRequestLog());
    assert.equal(lookup.found, false, 'profit-center request should not be issued when site data is empty');
});
