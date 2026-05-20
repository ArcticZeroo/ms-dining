/**
 * End-to-end test for the SearchQuery data service.
 *
 * Drives `services.data.searchQuery.*` (the main-side typed client) which
 * routes through the InProcessHandler to `searchQueryServiceCommands` and
 * finally to `SearchQueryClient`. Verifies the full service-layer wiring
 * works as expected for the smallest data service — template for the rest
 * of the phase-1 migrations.
 *
 * Uses a real Prisma + sqlite test database via createIntegrationTestContext.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../main/services/registry.js';
import { searchQueryService } from '../../../main/services/data/search-query.js';
import { SearchQueryClient } from './search-query.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
    ctx.installServices();
});

after(async () => {
    await ctx.cleanup();
});

test('services.data.searchQuery is the typed client (not the storage class)', () => {
    // Sanity: the Services bag's `data.searchQuery` field must be the typed
    // client wrapper, not the raw storage client. Catches accidental
    // production.ts wiring regressions.
    assert.equal(getServices().data.searchQuery, searchQueryService);
});

test('incrementSearchCount + getTopSearchQueries round-trip through the data handler', async () => {
    ctx.installServices();
    const { searchQuery } = getServices().data;

    await searchQuery.incrementSearchCount('Burger');
    await searchQuery.incrementSearchCount('Burger');
    await searchQuery.incrementSearchCount('Pizza');

    const top = await searchQuery.getTopSearchQueries(10);

    // Counts: burger=2 (incremented twice), pizza=1.
    // Query is lowercased + trimmed by the underlying impl.
    const byQuery = new Map(top.map(row => [row.query, row.count]));
    assert.equal(byQuery.get('burger'), 2);
    assert.equal(byQuery.get('pizza'), 1);
});

test('getTopSearchQueries default limit matches the storage client default (10)', async () => {
    ctx.installServices();
    const { searchQuery } = getServices().data;

    // Seed 12 distinct queries with distinct counts so we know the limit
    // determines how many come back, not the dataset size.
    for (let i = 0; i < 12; i++) {
        const term = `seedterm${i.toString().padStart(2, '0')}`;
        for (let bump = 0; bump <= i; bump++) {
            await searchQuery.incrementSearchCount(term);
        }
    }

    const top = await searchQuery.getTopSearchQueries();
    assert.equal(top.length, 10, 'default limit is 10');
});

test('incrementSearchCount normalizes input (trim + lowercase) so reads see canonical keys', async () => {
    ctx.installServices();
    const { searchQuery } = getServices().data;

    await searchQuery.incrementSearchCount('  Latte  ');
    await searchQuery.incrementSearchCount('LATTE');
    await searchQuery.incrementSearchCount('latte');

    const top = await searchQuery.getTopSearchQueries(50);
    const lattes = top.filter(row => row.query === 'latte');
    assert.equal(lattes.length, 1, 'all three writes coalesce into one row');
    assert.equal(lattes[0]!.count, 3);
});

test('SearchQueryClient direct calls remain functional (only proxied via service in production)', async () => {
    // The storage class is still used internally by searchQueryServiceCommands.
    // This test pins that the class works on its own so a future refactor that
    // accidentally breaks the direct API gets caught.
    ctx.installServices();
    await SearchQueryClient.incrementSearchCount('directcall');
    const top = await SearchQueryClient.getTopSearchQueries(50);
    assert.ok(top.some(row => row.query === 'directcall'));
});
