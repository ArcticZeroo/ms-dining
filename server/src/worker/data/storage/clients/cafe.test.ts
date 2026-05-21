/**
 * Integration tests for CafeStorageClient.
 *
 * Regression targets:
 *   - `776ef5d` — concurrent retrieveCafesAsync() calls under contention could
 *     double-populate the cache. The fix wraps initialization in a Lock and
 *     re-checks _hasInitialized inside the critical section.
 *   - `1793430` — resetCache() cleared _cafeDataById but left _hasInitialized
 *     set to true, so subsequent reads returned stale (empty) state forever.
 *     The fix flips _hasInitialized back to false.
 */

import { after, before, beforeEach, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CafeStorageClient } from './cafe.js';
import { usePrismaClient, usePrismaWrite } from '../client.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';

let ctx: IntegrationTestContext;

const SEEDED_CAFE_IDS = ['test-cafe-a', 'test-cafe-b', 'test-cafe-c'] as const;

const seedCafe = (id: string, name: string) =>
    usePrismaWrite(c => c.cafe.create({
        data: {
            id,
            name,
            tenantId:         'tenant-' + id,
            contextId:        'context-' + id,
            displayProfileId: 'dp-' + id,
            storeId:          'store-' + id,
            externalName:     name,
            logoName:         null,
        },
    }));

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

beforeEach(async () => {
    // CafeStorageClient holds module-level static state. Reset between tests
    // so each test starts from a known cache state.
    CafeStorageClient.resetCache();
    // Wipe any cafes seeded by a previous test so DB state is also fresh.
    await usePrismaWrite(c => c.cafe.deleteMany({}));
});

test('two concurrent retrieveCafesAsync() calls hit Prisma exactly once', async (t) => {
    for (let i = 0; i < SEEDED_CAFE_IDS.length; i++) {
        await seedCafe(SEEDED_CAFE_IDS[i]!, `Cafe ${i}`);
    }

    // Grab a reference to the Prisma client and instrument cafe.findMany so we
    // can count how many times CafeStorageClient hits the DB during the race.
    const prismaClient = await usePrismaClient(async (c) => c);
    const cafeDelegate = prismaClient.cafe as unknown as { findMany: (...args: unknown[]) => unknown };
    const realFindMany = cafeDelegate.findMany.bind(prismaClient.cafe);
    let findManyCallCount = 0;
    cafeDelegate.findMany = (...args: unknown[]) => {
        findManyCallCount++;
        return realFindMany(...args);
    };
    // Guarantee restoration even if any assertion below throws — otherwise
    // the monkey-patched findMany leaks into sibling tests in this file.
    t.after(() => {
        cafeDelegate.findMany = realFindMany;
    });

    // Confirm the cache is actually empty before the race.
    assert.equal(findManyCallCount, 0);

    const [a, b] = await Promise.all([
        CafeStorageClient.retrieveCafesAsync(),
        CafeStorageClient.retrieveCafesAsync(),
    ]);

    assert.equal(
        findManyCallCount,
        1,
        'Concurrent cache misses must coalesce into a single Prisma findMany',
    );
    assert.equal(a.size, SEEDED_CAFE_IDS.length);
    assert.equal(b.size, SEEDED_CAFE_IDS.length);
    // Both calls receive the same underlying map instance.
    assert.equal(a, b);
    for (const id of SEEDED_CAFE_IDS) {
        assert.ok(a.has(id), `expected cafe ${id} in cache`);
    }
});

test('cache populated exactly once even under heavier contention', async (t) => {
    for (let i = 0; i < SEEDED_CAFE_IDS.length; i++) {
        await seedCafe(SEEDED_CAFE_IDS[i]!, `Cafe ${i}`);
    }

    const prismaClient = await usePrismaClient(async (c) => c);
    const cafeDelegate = prismaClient.cafe as unknown as { findMany: (...args: unknown[]) => unknown };
    const realFindMany = cafeDelegate.findMany.bind(prismaClient.cafe);
    let findManyCallCount = 0;
    cafeDelegate.findMany = (...args: unknown[]) => {
        findManyCallCount++;
        return realFindMany(...args);
    };
    t.after(() => {
        cafeDelegate.findMany = realFindMany;
    });

    const results = await Promise.all(
        Array.from({ length: 10 }, () => CafeStorageClient.retrieveCafesAsync()),
    );

    assert.equal(findManyCallCount, 1, 'All 10 racers should see a single Prisma fetch');
    // Cache size matches what we seeded — i.e. each fetched cafe was added
    // exactly once (no duplicates from a race).
    assert.equal(results[0]!.size, SEEDED_CAFE_IDS.length);
});

test('resetCache() makes the next retrieveCafesAsync() re-fetch from Prisma', async () => {
    await seedCafe('test-cafe-a', 'A');

    // Prime the cache.
    const first = await CafeStorageClient.retrieveCafesAsync();
    assert.equal(first.size, 1);
    assert.ok(first.has('test-cafe-a'));

    // Add another cafe directly to the DB (bypassing the client) — the cache
    // would not see this without a reset.
    await seedCafe('test-cafe-b', 'B');

    // Without reset, the cache still reflects the old state.
    const stillStale = await CafeStorageClient.retrieveCafesAsync();
    assert.equal(stillStale.size, 1, 'Without resetCache the new cafe is invisible');

    // Reset and re-fetch.
    CafeStorageClient.resetCache();

    const reloaded = await CafeStorageClient.retrieveCafesAsync();
    assert.equal(reloaded.size, 2, 'resetCache must cause a re-fetch (regression: 1793430)');
    assert.ok(reloaded.has('test-cafe-a'));
    assert.ok(reloaded.has('test-cafe-b'));
});

test('previously-cached cafes are NOT returned after resetCache() drops them from the DB', async () => {
    await seedCafe('test-cafe-a', 'A');
    await seedCafe('test-cafe-b', 'B');

    // Prime cache: both cafes present.
    const primed = await CafeStorageClient.retrieveCafesAsync();
    assert.equal(primed.size, 2);

    // Drop one from the DB directly. The cache still has it...
    await usePrismaWrite(c => c.cafe.delete({ where: { id: 'test-cafe-a' } }));
    const stillCached = await CafeStorageClient.retrieveCafesAsync();
    assert.ok(stillCached.has('test-cafe-a'), 'before reset the deleted cafe still shows from cache');

    // ...until we reset and re-read.
    CafeStorageClient.resetCache();
    const afterReset = await CafeStorageClient.retrieveCafesAsync();
    assert.equal(afterReset.size, 1);
    assert.equal(afterReset.has('test-cafe-a'), false, 'Reset must drop the previously cached, now-deleted cafe');
    assert.ok(afterReset.has('test-cafe-b'));
});
