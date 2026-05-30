/**
 * Tests for the station cache (cache/stations.ts).
 *
 * Validates lazy population, lookup helpers, and incremental
 * updates via STORAGE_EVENTS.menuPublished.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../tests/test-server/integration-test-context.js';
import { usePrismaTransaction } from '../storage/client.js';
import { retrieveStation, getStationNamesByIds } from './stations.js';
import type { IMenuPublishEvent } from '../../../shared/models/storage-events.js';
import type { ICafeStation } from '../../../shared/models/cafe.js';
import { STORAGE_EVENTS } from '../../../shared/util/events.js';

let ctx: IntegrationTestContext;

const CAFE_ID = 'station-cache-cafe';
const STATION_A_ID = 'station-a';
const STATION_B_ID = 'station-b';

before(async () => {
    ctx = await createIntegrationTestContext();

    await usePrismaTransaction(async prisma => {
        await prisma.cafe.create({
            data: {
                id: CAFE_ID, name: 'Cache Test Café', tenantId: 't', contextId: 'c',
                displayProfileId: 'd', storeId: 's', externalName: 'e',
            },
        });
        await prisma.station.create({
            data: {
                id: STATION_A_ID, name: 'Alpha Station', menuId: 'menu-a',
                cafeId: CAFE_ID, normalizedName: 'alpha station',
            },
        });
        await prisma.station.create({
            data: {
                id: STATION_B_ID, name: 'Beta Station', menuId: 'menu-b',
                cafeId: CAFE_ID, normalizedName: 'beta station',
            },
        });
    });
});

after(async () => {
    await ctx.cleanup();
});

test('retrieveStation returns station record on first access (lazy load)', async () => {
    const station = await retrieveStation(STATION_A_ID);
    assert.ok(station);
    assert.equal(station.id, STATION_A_ID);
    assert.equal(station.name, 'Alpha Station');
    assert.equal(station.cafeId, CAFE_ID);
});

test('retrieveStation returns null for unknown station', async () => {
    const station = await retrieveStation('nonexistent');
    assert.equal(station, null);
});

test('getStationNamesByIds returns names for known stations', async () => {
    const names = await getStationNamesByIds([STATION_A_ID, STATION_B_ID]);
    assert.equal(names.size, 2);
    assert.equal(names.get(STATION_A_ID), 'Alpha Station');
    assert.equal(names.get(STATION_B_ID), 'Beta Station');
});

test('getStationNamesByIds skips unknown IDs', async () => {
    const names = await getStationNamesByIds([STATION_A_ID, 'unknown']);
    assert.equal(names.size, 1);
    assert.equal(names.get(STATION_A_ID), 'Alpha Station');
});

test('getStationNamesByIds returns empty map for empty input', async () => {
    const names = await getStationNamesByIds([]);
    assert.equal(names.size, 0);
});

test('menuPublished event updates cached station names', async () => {
    // Ensure cache is populated first
    await retrieveStation(STATION_A_ID);

    // Simulate a menu publish that renames station A
    const fakeEvent: IMenuPublishEvent = {
        cafe:                       { id: CAFE_ID, name: 'Cache Test Café' },
        dateString:                 '2026-05-28',
        isAvailable:                true,
        menu:                       [{
            id:                      STATION_A_ID,
            menuId:                  'menu-a',
            cafeId:                  CAFE_ID,
            groupId:                 null,
            name:                    'Alpha Station Renamed',
            menuItemIdsByCategoryName: new Map(),
            menuItemsById:           new Map(),
            opensAt:                 660,
            closesAt:                840,
        } as ICafeStation],
        addedStations:              new Set(),
        removedStations:            new Set(),
        updatedStations:            new Set([STATION_A_ID]),
        dirtyStations:              new Set([STATION_A_ID]),
        removedMenuItemsByStation:  new Map(),
        addedMenuItemsByStation:    new Map(),
        dirtyMenuItemIds:           new Set(),
    };

    STORAGE_EVENTS.emit('menuPublished', fakeEvent);

    const station = await retrieveStation(STATION_A_ID);
    assert.ok(station);
    assert.equal(station.name, 'Alpha Station Renamed');
});
