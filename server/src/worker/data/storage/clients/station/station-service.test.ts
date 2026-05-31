/**
 * End-to-end test for the Station data service.
 *
 * Drives `services.data.station.*` through the InProcessHandler to
 * `stationServiceCommands` and finally to `StationStorageClient`.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../../shared/services/registry.js';
import { CafeStorageClient } from '../cafe/cafe.js';
import { usePrismaWrite } from '../../client.js';
import type { ICafeStation } from '../../../../../shared/models/cafe.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();

    // Stations have a FK to Cafe, so seed one.
    CafeStorageClient.resetCache();
    await getServices().data.cafe.createCafe({
        cafe:   { id: 'station-test-cafe', name: 'Café for Station Tests' },
        config: {
            tenantId: 't', contextId: 'c', displayProfileId: 'd',
            storeId: 's', externalName: 'e', isShutDown: false,
        },
    });
});

after(async () => {
    await ctx.cleanup();
});

const STATION: ICafeStation = {
    id:       'station-1',
    name:     'Grill Station',
    menuId:   'menu-1',
    cafeId:   'station-test-cafe',
    groupId:  null,
    logoUrl:  'https://example.com/logo.png',
    menuItemsById: new Map(),
    menuItemIdsByCategoryName: new Map(),
    opensAt:  600,
    closesAt: 900,
};

test('retrieveStation returns null for nonexistent id', async () => {
    const result = await getServices().data.station.retrieveStation({ stationId: 'no-such-station' });
    assert.equal(result, null);
});

test('createStation + retrieveStation round-trip', async () => {

    await getServices().data.station.createStation({ station: STATION });

    const record = await getServices().data.station.retrieveStation({ stationId: STATION.id });
    assert.ok(record);
    assert.equal(record.id, STATION.id);
    assert.equal(record.name, STATION.name);
    assert.equal(record.cafeId, STATION.cafeId);
    assert.equal(record.logoUrl, STATION.logoUrl);
    assert.equal(record.menuId, STATION.menuId);
    assert.equal(record.groupId, null);
    assert.equal(record.opensAt, STATION.opensAt);
    assert.equal(record.closesAt, STATION.closesAt);
});

test('retrieveAllStationsWithoutGroup includes ungrouped stations', async () => {
    const ungrouped = await getServices().data.station.retrieveAllStationsWithoutGroup({});
    assert.ok(ungrouped.some(station => station.id === STATION.id));
});

test('retrieveAllStationNames includes station names', async () => {
    const names = await getServices().data.station.retrieveAllStationNames({});
    assert.ok(names.includes(STATION.name));
});

// ─── Hours queries ──────────────────────────────────────────────────────────

test('getStationHours returns hours for an existing station', async () => {
    const hours = await getServices().data.station.getStationHours({ stationId: STATION.id });
    assert.ok(hours);
    assert.equal(hours.opensAt, STATION.opensAt);
    assert.equal(hours.closesAt, STATION.closesAt);
});

test('getStationHours returns null for nonexistent station', async () => {
    const hours = await getServices().data.station.getStationHours({ stationId: 'no-such-station' });
    assert.equal(hours, null);
});

test('getCafeHoursForDate aggregates hours from stations present on that date', async () => {
    // Create a second station with different hours
    const earlyStation: ICafeStation = {
        ...STATION,
        id:       'station-early',
        name:     'Early Bird',
        menuId:   'menu-early',
        opensAt:  420,   // 7 AM
        closesAt: 720,   // 12 PM
    };
    await getServices().data.station.createStation({ station: earlyStation });

    // Seed DailyCafe + DailyStations for a specific date
    const dateString = '2026-06-01';
    await usePrismaWrite(prisma => prisma.dailyCafe.create({
        data: { dateString, cafeId: STATION.cafeId, isAvailable: true },
    }));
    await usePrismaWrite(prisma => prisma.dailyStation.create({
        data: { dateString, cafeId: STATION.cafeId, stationId: STATION.id },
    }));
    await usePrismaWrite(prisma => prisma.dailyStation.create({
        data: { dateString, cafeId: STATION.cafeId, stationId: earlyStation.id },
    }));

    const hours = await getServices().data.station.getCafeHoursForDate({
        cafeId: STATION.cafeId,
        dateString,
    });

    assert.ok(hours);
    assert.equal(hours.opensAt, 420, 'should use the earliest opensAt across active stations');
    assert.equal(hours.closesAt, 900, 'should use the latest closesAt across active stations');
});

test('getCafeHoursForDate returns null when no stations are present on that date', async () => {
    const hours = await getServices().data.station.getCafeHoursForDate({
        cafeId: STATION.cafeId,
        dateString: '2099-01-01',
    });
    assert.equal(hours, null);
});
