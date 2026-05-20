/**
 * Integration tests for OrderingClient.
 *
 * Regression target `00f833a` — creating an ordering context for a (cafeId,
 * dateString) that already had a row raised a Prisma unique-constraint error.
 * The fix switched create→upsert so the second call updates the row in place.
 *
 * The tests also cover the surrounding cache contract:
 *   - per-cafe cache (a write/read for cafe A does not evict cafe B)
 *   - stale entries are dropped when the day rolls over
 */

import { after, before, beforeEach, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { OrderingClient } from './ordering.js';
import { usePrismaClient, usePrismaWrite } from '../client.js';
import { IOrderingContext } from '../../../shared/models/cart.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../test-server/integration-test-context.js';
import { toDateString } from '@msdining/common/util/date-util';

let ctx: IntegrationTestContext;

// Pin "now" to a known weekday so toDateString stays stable across operations
// within the test (and so the "day rolls over" test can advance the clock).
// Pick midday-local-ish times so the date string is stable across timezones —
// 12:00 UTC + a one-day gap is comfortably more than any TZ offset, so DAY_ONE
// and DAY_TWO always produce different local date strings.
const DAY_ONE = new Date('2026-05-13T12:00:00Z'); // Wednesday
const DAY_TWO = new Date('2026-05-14T12:00:00Z'); // Thursday

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

beforeEach(async () => {
    // Clean DB + reset clock between tests so static OrderingClient cache state
    // doesn't poison subsequent assertions.
    await usePrismaWrite(c => c.dailyCafeOrderingContext.deleteMany({}));
    await usePrismaWrite(c => c.cafe.deleteMany({}));
    mock.timers.reset();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const seedCafe = (id: string) =>
    usePrismaWrite(c => c.cafe.create({
        data: {
            id,
            name:             id,
            tenantId:         't-' + id,
            contextId:        'ctx-' + id,
            displayProfileId: 'dp-' + id,
            storeId:          's-' + id,
            externalName:     id,
            logoName:         null,
        },
    }));

const makeContext = (label: string): IOrderingContext => ({
    onDemandTerminalId: 'terminal-' + label,
    onDemandEmployeeId: 'employee-' + label,
    profitCenterId:     'profit-' + label,
    storePriceLevel:    'price-' + label,
    profitCenterName:   'Profit ' + label,
    payClientId:        'pay-' + label,
});

const assertContextsEqual = (actual: IOrderingContext | null | undefined, expected: IOrderingContext) => {
    assert.ok(actual, 'expected an ordering context but got null/undefined');
    assert.equal(actual.onDemandTerminalId, expected.onDemandTerminalId);
    assert.equal(actual.onDemandEmployeeId, expected.onDemandEmployeeId);
    assert.equal(actual.profitCenterId, expected.profitCenterId);
    assert.equal(actual.profitCenterName, expected.profitCenterName);
    assert.equal(actual.storePriceLevel, expected.storePriceLevel);
    assert.equal(actual.payClientId, expected.payClientId);
};

// ─── 00f833a: second create for same (cafeId, date) upserts, never throws ──

test('createOrderingContextAsync upserts on duplicate (cafeId, dateString) instead of throwing (regression 00f833a)', async () => {
    mock.timers.enable({ apis: ['Date'], now: DAY_ONE });

    const cafeId = 'order-cafe-a';
    await seedCafe(cafeId);

    const first = makeContext('first');
    await OrderingClient.createOrderingContextAsync(cafeId, first);

    // Sanity: row landed.
    const rowCount = await usePrismaClient(c => c.dailyCafeOrderingContext.count({ where: { cafeId } }));
    assert.equal(rowCount, 1);

    // The bug: this used to throw P2002 because (dateString, cafeId) is the
    // primary key. The fix is an upsert — it must succeed AND update the row.
    const second = makeContext('second');
    await assert.doesNotReject(
        OrderingClient.createOrderingContextAsync(cafeId, second),
        'second create for the same (cafeId, date) must not throw',
    );

    // Still exactly one row.
    const rowCountAfter = await usePrismaClient(c => c.dailyCafeOrderingContext.count({ where: { cafeId } }));
    assert.equal(rowCountAfter, 1);

    // The retrieved context reflects the second write.
    const retrieved = await OrderingClient.retrieveOrderingContextAsync(cafeId);
    assertContextsEqual(retrieved, second);

    // And the DB row matches too (not just the in-memory cache).
    const dbRow = await usePrismaClient(c => c.dailyCafeOrderingContext.findFirst({ where: { cafeId } }));
    assert.ok(dbRow);
    assert.equal(dbRow.profitCenterId, second.profitCenterId);
});

// ─── Per-cafe cache: writes/reads on A do not evict B ──────────────────────

test('per-cafe cache: operations on cafe A do not evict cafe B from the cache', async () => {
    mock.timers.enable({ apis: ['Date'], now: DAY_ONE });

    await seedCafe('order-cafe-a');
    await seedCafe('order-cafe-b');

    const ctxA = makeContext('A');
    const ctxB = makeContext('B');

    // Populate cache for both cafes.
    await OrderingClient.createOrderingContextAsync('order-cafe-a', ctxA);
    await OrderingClient.createOrderingContextAsync('order-cafe-b', ctxB);

    assertContextsEqual(await OrderingClient.retrieveOrderingContextAsync('order-cafe-a'), ctxA);
    assertContextsEqual(await OrderingClient.retrieveOrderingContextAsync('order-cafe-b'), ctxB);

    // Now mutate cafe B's DB row directly, bypassing OrderingClient. If the
    // cache properly per-cafe-keys B's entry, retrieve(B) should still hit
    // cache and return the original ctxB (not see the DB mutation).
    const dayOneDateString = toDateString(new Date());
    await usePrismaWrite(c => c.dailyCafeOrderingContext.update({
        where: { dateString_cafeId: { dateString: dayOneDateString, cafeId: 'order-cafe-b' } },
        data:  { profitCenterId: 'CHANGED-IN-DB' },
    }));

    const stillCachedB = await OrderingClient.retrieveOrderingContextAsync('order-cafe-b');
    assert.equal(
        stillCachedB?.profitCenterId,
        ctxB.profitCenterId,
        'cafe B should still come from cache (the DB mutation should not be visible)',
    );

    // Cafe A — completely untouched — still resolves from its own cache entry.
    const stillCachedA = await OrderingClient.retrieveOrderingContextAsync('order-cafe-a');
    assertContextsEqual(stillCachedA, ctxA);

    // Now overwrite A via the client. B should still be cached unaffected.
    const ctxANew = makeContext('A-new');
    await OrderingClient.createOrderingContextAsync('order-cafe-a', ctxANew);

    assertContextsEqual(await OrderingClient.retrieveOrderingContextAsync('order-cafe-a'), ctxANew);
    assertContextsEqual(
        await OrderingClient.retrieveOrderingContextAsync('order-cafe-b'),
        ctxB,
    );

    // Symmetric check: overwriting cafe B's slot must NOT evict cafe A. The
    // earlier assertions only established that B survives an A write; without
    // this, a shared-state bug where the cache only retains the most-recent
    // (cafeId, context) write would still pass.
    const ctxBNew = makeContext('B-new');
    await OrderingClient.createOrderingContextAsync('order-cafe-b', ctxBNew);

    const aAfterBOverwrite = await OrderingClient.retrieveOrderingContextAsync('order-cafe-a');
    assert.equal(
        aAfterBOverwrite?.profitCenterId,
        ctxANew.profitCenterId,
        'A must survive B\'s write — independent per-cafe cache slots',
    );
    assertContextsEqual(aAfterBOverwrite, ctxANew);
    assertContextsEqual(
        await OrderingClient.retrieveOrderingContextAsync('order-cafe-b'),
        ctxBNew,
    );
});

// ─── Stale entry dropped when the date rolls over ──────────────────────────

test('a cached entry from yesterday is dropped on a fresh retrieval today', async () => {
    mock.timers.enable({ apis: ['Date'], now: DAY_ONE });
    const cafeId = 'order-cafe-stale';
    await seedCafe(cafeId);

    const yesterdayContext = makeContext('yesterday');
    await OrderingClient.createOrderingContextAsync(cafeId, yesterdayContext);
    // Right now: cache has an entry stamped with DAY_ONE.
    assertContextsEqual(
        await OrderingClient.retrieveOrderingContextAsync(cafeId),
        yesterdayContext,
    );

    // Roll the clock forward to the next day. The cached entry's
    // lastRetrievedDate (DAY_ONE) no longer matches today (DAY_TWO), so
    // _ensureCacheIsRecent should drop it.
    mock.timers.setTime(DAY_TWO.getTime());

    // The DB still only has a row for DAY_ONE; the lookup for DAY_TWO returns
    // nothing. If the cache had not been invalidated, we'd still see
    // yesterdayContext (the bug). With invalidation, we get null/undefined.
    const today = await OrderingClient.retrieveOrderingContextAsync(cafeId);
    assert.ok(
        today == null,
        'stale entry from yesterday must be dropped — today has no DB row, so the result should be null',
    );

    // Writing a fresh context today populates a new DB row + cache entry.
    const todayContext = makeContext('today');
    await OrderingClient.createOrderingContextAsync(cafeId, todayContext);

    assertContextsEqual(await OrderingClient.retrieveOrderingContextAsync(cafeId), todayContext);

    // Two distinct rows exist: yesterday's and today's.
    const rows = await usePrismaClient(c => c.dailyCafeOrderingContext.findMany({
        where:   { cafeId },
        orderBy: { dateString: 'asc' },
    }));
    assert.equal(rows.length, 2);
    const dayTwoString = toDateString(new Date());
    // Sanity check: the two date strings differ — i.e. the rollover actually
    // crossed a local-day boundary.
    assert.notEqual(rows[0]!.dateString, rows[1]!.dateString);
    assert.equal(rows[1]!.dateString, dayTwoString);
});
