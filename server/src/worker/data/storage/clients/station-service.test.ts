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
} from '../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../main/services/registry.js';
import { stationService } from '../../../../main/services/data/station.js';
import { CafeStorageClient } from './cafe.js';
import type { ICafe, ICafeConfig, ICafeStation } from '../../../../shared/models/cafe.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
    ctx.installServices();

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
    opensAt:  0,
    closesAt: 0,
};

test('services.data.station is the typed client', () => {
    assert.equal(getServices().data.station, stationService);
});

test('retrieveStation returns null for nonexistent id', async () => {
    ctx.installServices();
    const result = await getServices().data.station.retrieveStation({ stationId: 'no-such-station' });
    assert.equal(result, null);
});

test('createStation + retrieveStation round-trip', async () => {
    ctx.installServices();

    await getServices().data.station.createStation({ station: STATION });

    const record = await getServices().data.station.retrieveStation({ stationId: STATION.id });
    assert.ok(record);
    assert.equal(record.id, STATION.id);
    assert.equal(record.name, STATION.name);
    assert.equal(record.cafeId, STATION.cafeId);
    assert.equal(record.logoUrl, STATION.logoUrl);
    assert.equal(record.menuId, STATION.menuId);
    assert.equal(record.groupId, null);
});

test('retrieveAllStationsWithoutGroup includes ungrouped stations', async () => {
    ctx.installServices();
    const ungrouped = await getServices().data.station.retrieveAllStationsWithoutGroup({});
    assert.ok(ungrouped.some(s => s.id === STATION.id));
});

test('retrieveAllStationNames includes station names', async () => {
    ctx.installServices();
    const names = await getServices().data.station.retrieveAllStationNames({});
    assert.ok(names.includes(STATION.name));
});
