/**
 * Integration test for the menu-watermark + menu-etag pipeline.
 *
 * Verifies:
 *   - First request emits an ETag header with Cache-Control: no-cache.
 *   - Second request with matching If-None-Match returns 304 + empty body.
 *   - A no-op re-sync (same fixture data) does NOT bump the watermark, so
 *     the prior ETag still produces 304.
 *   - A real menu change (fixture mutation that adds a new item) DOES bump
 *     the watermark, so the prior ETag now produces 200 + a strictly larger
 *     (newer) ETag.
 *
 * Tests assert behavior (ETag stability, 304 vs 200, monotonic increase)
 * rather than exact timestamp values, because the watermark's Date.now()
 * runs in the data-service worker thread where mock.timers cannot reach.
 *
 * Tests use a single cafe (cafe25) re-synced directly via
 * CafeMenuSession.retrieveMenuAsync + saveDailyMenuAsync rather than the
 * full performMenuBootTasks pipeline, to keep each scenario fast and
 * isolated.
 */

import { after, before, mock, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { DateUtil } from '@msdining/common';
import { CafeMenuSession } from '../../worker/data/cafe/session/menu.js';
import { saveDailyMenuAsync } from '../../worker/data/cafe/job/storage.js';
import { DailyMenuStorageClient } from '../../worker/data/storage/clients/daily-menu/daily-menu.js';
import { ALL_CAFES } from '../../shared/constants/cafes.js';
import { ICafe } from '../../shared/models/cafe.js';
import { IMenuPublishEvent } from '../../shared/models/storage-events.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../test-server/integration-test-context.js';
import { fetchExpectStatus } from '../test-server/test-helpers.js';
import { CACHE_EVENTS } from '../../shared/util/events.js';

// Pin to a Wednesday so production weekend-skip logic doesn't short-circuit.
const FAKE_NOW = new Date('2026-05-13T12:00:00Z');

const CAFE_ID = 'cafe25';

let ctx: IntegrationTestContext;
let baseUrl: string;
let todayString: string;
let cafe: ICafe;
// Captured from the first successful GET — used as reference for later tests.
let initialEtag: string;

/**
 * Extract the numeric timestamp embedded inside a weak ETag like `W/"1234"`.
 * Returns NaN if the ETag doesn't match the expected format.
 */
const parseEtagTimestamp = (etag: string): number => {
    const match = /^W\/"(\d+)"$/.exec(etag);
    return match ? Number(match[1]) : NaN;
};

/**
 * Waits for the next CACHE_EVENTS.menuPublished emission. The cache-events
 * bridge runs as a microtask chain after STORAGE_EVENTS fires (see
 * worker/data/cache/daily-menu.ts), so triggering work then awaiting this
 * promise guarantees the watermark listener has observed the event before
 * we inspect anything.
 */
const waitForCacheMenuPublished = (): Promise<IMenuPublishEvent> => {
    return new Promise((resolve) => {
        const handler = (event: IMenuPublishEvent) => {
            CACHE_EVENTS.off('menuPublished', handler);
            resolve(event);
        };
        CACHE_EVENTS.on('menuPublished', handler);
    });
};

/**
 * Drive a full re-sync of one cafe through the same code path production
 * uses. Returns once the CACHE_EVENTS.menuPublished event has fired, so
 * the watermark listener has definitely observed it.
 */
const resyncCafe = async (): Promise<IMenuPublishEvent> => {
    const eventPromise = waitForCacheMenuPublished();
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
    return eventPromise;
};

const menuUrl = `/api/dining/menu/${CAFE_ID}/menu`;

before(async () => {
    mock.timers.enable({ apis: ['Date'], now: FAKE_NOW });
    todayString = DateUtil.toDateString(new Date());

    ctx = await createIntegrationTestContext({ useWorkerThread: true });
    baseUrl = await ctx.startWebserver();

    const found = ALL_CAFES.find((availableCafe) => availableCafe.id === CAFE_ID);
    assert.ok(found, `${CAFE_ID} should exist in ALL_CAFES`);
    cafe = found;

    // Initial sync so the cafe-day has data + a watermark.
    const initialEvent = await resyncCafe();
    assert.ok(initialEvent.dirtyStations.size > 0, 'initial sync should mark stations dirty');
    assert.ok(initialEvent.dirtyMenuItemIds.size > 0, 'initial sync should mark menu items dirty');
}, { timeout: 60_000 });

after(async () => {
    await ctx.cleanup();
    mock.timers.reset();
});

test('first menu request emits an ETag', async () => {
    const res = await fetchExpectStatus(`${baseUrl}${menuUrl}?date=${todayString}`, 200);
    const etag = res.headers.get('etag');
    assert.ok(etag, 'response should include an ETag header');
    assert.match(etag, /^W\/"[0-9]+"$/, 'ETag should be a weak validator wrapping a numeric timestamp');
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    initialEtag = etag;
});

test('matching If-None-Match returns 304 + empty body', async () => {
    const revalidation = await fetchExpectStatus(
        `${baseUrl}${menuUrl}?date=${todayString}`,
        304,
        { headers: { 'If-None-Match': initialEtag } },
    );
    const body = await revalidation.text();
    assert.equal(body, '', '304 response should have an empty body');
    assert.equal(revalidation.headers.get('etag'), initialEtag);
});

test('no-op resync preserves the watermark — prior ETag still revalidates as 304', async () => {
    const event = await resyncCafe();
    assert.equal(event.dirtyStations.size, 0, 'no-op resync should not produce dirty stations');
    assert.equal(event.dirtyMenuItemIds.size, 0, 'no-op resync should not produce dirty items');

    // Watermark should be unchanged — the same ETag should still produce 304.
    const revalidation = await fetchExpectStatus(
        `${baseUrl}${menuUrl}?date=${todayString}`,
        304,
        { headers: { 'If-None-Match': initialEtag } },
    );
    assert.equal(revalidation.headers.get('etag'), initialEtag);
});

test('real menu change bumps the watermark — new ETag is strictly larger', async () => {
    // Inject a brand-new menu item into cafe25's fixture so the resync
    // observes it as an addition. Added/removed items are the only thing
    // that populates dirtyMenuItemIds (see daily-menu.ts:computeMenuPublishDiff).
    const items = ctx.server.state.getFixture<Array<Record<string, unknown>>>(CAFE_ID, 'menu-items') ?? [];
    const stations = ctx.server.state.getFixture<Array<{
        id: string;
        menus: Array<{ categories: Array<{ items: string[] }> }>;
    }>>(CAFE_ID, 'stations') ?? [];

    const newItemId = 'etag-test-new-item';
    const augmentedItems = [
        ...items,
        {
            id:                          newItemId,
            amount:                      '4.99',
            displayText:                 'ETag Test Special',
            properties:                  { calories: '100', maxCalories: '150' },
            description:                 'New item injected by the etag integration test.',
            lastUpdateTime:              '2025-01-01T00:00:00.000Z',
            isItemCustomizationEnabled:  false,
            receiptText:                 'ETAG TEST',
            tagIds:                      [],
            priceLevels:                 {
                'price-level-1': {
                    priceLevelId: 'price-level-1',
                    name:         'Default',
                    price:        { currencyUnit: 'USD', amount: '4.99' },
                },
            },
        },
    ];

    // Hand the new item to the first station's first category so the diff
    // pipeline classifies it as added rather than orphaned.
    const augmentedStations = stations.map((station, index) => {
        if (index !== 0) {
            return station;
        }
        return {
            ...station,
            menus: station.menus.map((menu, menuIndex) => {
                if (menuIndex !== 0) {
                    return menu;
                }
                return {
                    ...menu,
                    categories: menu.categories.map((category, catIndex) => {
                        if (catIndex !== 0) {
                            return category;
                        }
                        return { ...category, items: [...category.items, newItemId] };
                    }),
                };
            }),
        };
    });

    ctx.server.setFixture(CAFE_ID, 'menu-items', augmentedItems);
    ctx.server.setFixture(CAFE_ID, 'stations', augmentedStations);

    const event = await resyncCafe();
    assert.ok(
        event.dirtyMenuItemIds.has(newItemId),
        `resync after fixture mutation should mark ${newItemId} dirty (got: ${[...event.dirtyMenuItemIds].join(', ')})`,
    );

    // Prior ETag should no longer match — server returns 200 with a new ETag.
    const revalidation = await fetchExpectStatus(
        `${baseUrl}${menuUrl}?date=${todayString}`,
        200,
        { headers: { 'If-None-Match': initialEtag } },
    );
    const newEtag = revalidation.headers.get('etag');
    assert.ok(newEtag, 'response should include a new ETag');
    assert.notEqual(newEtag, initialEtag, 'new ETag should differ from the initial one');

    // The watermark is a Date.now() timestamp — new ETag must be strictly
    // larger (more recent) than the initial one.
    const initialTs = parseEtagTimestamp(initialEtag);
    const newTs = parseEtagTimestamp(newEtag);
    assert.ok(!Number.isNaN(initialTs) && !Number.isNaN(newTs), 'both ETags should contain valid timestamps');
    assert.ok(newTs > initialTs, `new watermark (${newTs}) should be strictly larger than initial (${initialTs})`);
});
