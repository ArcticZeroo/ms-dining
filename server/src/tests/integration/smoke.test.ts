/**
 * Smoke test for the integration test infrastructure.
 *
 * This test validates that the entire test bootstrap works end-to-end:
 *   1. createIntegrationTestContext() sets up temp DBs, mock AI, test server
 *   2. Production sync code (CafeMenuSession.retrieveMenuAsync +
 *      saveDailyMenuAsync) successfully discovers a cafe menu through the
 *      in-memory TestBuyOnDemandServer
 *   3. The resulting data lands in the temp Prisma DB
 *   4. The mock AI provider returns deterministic embeddings
 *   5. Failure injection bubbles through the real client code paths
 *   6. Cleanup tears everything down
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CafeMenuSession } from '../../worker/data/cafe/session/menu.js';
import { saveDailyMenuAsync } from '../../worker/data/cafe/job/storage.js';
import { usePrismaClient } from '../../worker/data/storage/client.js';
import { DailyMenuStorageClient } from '../../worker/data/storage/clients/daily-menu/daily-menu.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

test('sync a single cafe end-to-end', async () => {
    const cafe = ALL_CAFES.find(availableCafe => availableCafe.id === 'cafe25');
    assert.ok(cafe, 'cafe25 should exist in ALL_CAFES');

    // Drive the real production sync code path. CafeMenuSession.retrieveMenuAsync
    // calls createBuyOnDemandClient(cafe), which is routed via getServices()
    // to the per-context test buyOnDemandFactory backed by our in-memory test server.
    const result = await CafeMenuSession.retrieveMenuAsync(cafe, 0);

    assert.ok(result.isAvailable, 'cafe should be available');
    assert.ok(result.stations.length > 0, 'should have at least one station');

    // Persist the discovered menu to the test DB. DailyCafe must exist before
    // DailyStation can reference it via composite FK (dateString, cafeId).
    const today = new Date().toISOString().slice(0, 10);
    await DailyMenuStorageClient.upsertDailyCafeAsync(cafe.id, today, {
        isAvailable: true,
        shutdownMessageHash: null,
    });
    await saveDailyMenuAsync({
        cafe,
        dateString: today,
        isAvailable: true,
        stations: result.stations,
        shouldUpdateExistingItems: true,
    });

    // Verify Cafe + Station + MenuItem rows exist in the temp DB.
    const counts = await usePrismaClient(async (client) => {
        const cafeRow = await client.cafe.findUnique({ where: { id: 'cafe25' } });
        const stationCount = await client.station.count({ where: { cafeId: 'cafe25' } });
        const menuItemCount = await client.menuItem.count({ where: { cafeId: 'cafe25' } });
        const dailyStationCount = await client.dailyStation.count({
            where: { cafeId: 'cafe25', dateString: today },
        });
        const dailyMenuItemCount = await client.dailyMenuItem.count({
            where: {
                category: {
                    snapshot: {
                        dailyStations: {
                            some: { cafeId: 'cafe25', dateString: today },
                        },
                    },
                },
            },
        });
        return { cafeRow, stationCount, menuItemCount, dailyStationCount, dailyMenuItemCount };
    });

    assert.ok(counts.cafeRow, 'Cafe row should exist');
    assert.equal(counts.cafeRow.id, 'cafe25');
    assert.ok(counts.stationCount > 0, `Should have stations (got ${counts.stationCount})`);
    assert.ok(counts.menuItemCount > 0, `Should have menu items (got ${counts.menuItemCount})`);
    assert.ok(counts.dailyStationCount > 0, `Should have daily stations (got ${counts.dailyStationCount})`);
    assert.ok(counts.dailyMenuItemCount > 0, `Should have daily menu items (got ${counts.dailyMenuItemCount})`);
});

test('mock AI provider returns deterministic embeddings', async () => {
    const embedding = await ctx.mockAi.retrieveEmbedding('hello world');
    assert.equal(embedding.length, 1536);
    // Same input produces same output (deterministic).
    const embedding2 = await ctx.mockAi.retrieveEmbedding('hello world');
    assert.deepEqual(embedding, embedding2);
    // Different input produces different output.
    const embedding3 = await ctx.mockAi.retrieveEmbedding('different text');
    assert.notDeepEqual(embedding, embedding3);
});

test('failure injection works through full stack', async () => {
    ctx.server.clearFailures();
    ctx.server.injectFailure({
        method: 'POST',
        pathPattern: /\/kiosk-items\/get-items$/,
        statusCode: 503,
        body: 'simulated outage',
        count: 1,
    });

    const cafe = ALL_CAFES.find(availableCafe => availableCafe.id === 'foodhall4');
    assert.ok(cafe);

    // The injected 503 propagates through retrieveMenuItemsAsync up through
    // CafeMenuSession. We just want to confirm the failure actually fires and
    // bubbles correctly — i.e. that the test server's failure injection is
    // observable from real production code paths.
    await assert.rejects(
        () => CafeMenuSession.retrieveMenuAsync(cafe, 0),
        /503/,
        'CafeMenuSession should propagate the injected 503',
    );
});

test('test server rejects requests without an Authorization header', async () => {
    // Direct handleRequest call with no Authorization header — mirrors what
    // would happen if a production code path forgot to include credentials.
    const res = await ctx.server.handleRequest('cafe25', 'GET', '/config');
    assert.equal(res.status, 401);
});

test('test server rejects requests with an unknown Bearer token', async () => {
    const res = await ctx.server.handleRequest('cafe25', 'GET', '/config', {
        headers: { Authorization: 'Bearer not-a-real-token' },
    });
    assert.equal(res.status, 401);
});

test('test server allows /login/anonymous without a token', async () => {
    const res = await ctx.server.handleRequest('cafe25', 'GET', '/login/anonymous');
    assert.equal(res.status, 200);
});
