/**
 * Tests for station name selection (`pickStationName`, exercised via
 * retrieveStationListAsync → CafeMenuSession.retrieveMenuAsync).
 *
 * Integration-style: drives the real BuyOnDemandClient code path against
 * the in-memory TestBuyOnDemandServer. Each test seeds a custom `stations`
 * fixture for a dedicated cafe id, then runs the production sync and reads
 * back the resolved station name.
 *
 * Regression target: 03cce02 — switch station name being just a space.
 */

import { after, before, beforeEach, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { CafeMenuSession } from '../session/menu.js';
import { ICafe } from '../../../models/cafe.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../test-server/integration-test-context.js';

const STATION_TEST_CAFE_ID = 'station-name-test-cafe';
const STATION_TEST_CAFE: ICafe = {
    id:   STATION_TEST_CAFE_ID,
    name: 'Stub Cafe Display Name',
};

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
    ctx.installServices();

    // Boot a config fixture for our test cafe so /config returns sane data and
    // the test cafe id resolves to a proper tenant/context/displayProfile.
    ctx.server.setFixture(STATION_TEST_CAFE_ID, 'config', {
        tenantID:  'tenant-station-test',
        contextID: 'ctx-station-test',
        theme:     { logoImage: 'logo.png' },
        storeList: [
            {
                storeInfo: { storeInfoId: 'store-station-test', storeName: 'Stub Cafe Display Name' },
                displayProfileId: ['dp-station-test'],
            },
        ],
        properties: {},
    });
});

after(async () => {
    await ctx.cleanup();
});

beforeEach(() => {
    ctx.server.clearRequestLog();
    ctx.server.clearFailures();
});

test('whitespace-only station name falls back to cafe name', async () => {
    ctx.installServices();
    assert.equal(await pickName({ name: '   ' }), STATION_TEST_CAFE.name);
});

test('empty station name falls back to cafe name', async () => {
    ctx.installServices();
    assert.equal(await pickName({ name: '' }), STATION_TEST_CAFE.name);
});

test('normal station name is preserved', async () => {
    ctx.installServices();
    assert.equal(await pickName({ name: 'Pizza Hut' }), 'Pizza Hut');
});

test('station name is trimmed of leading/trailing whitespace', async () => {
    ctx.installServices();
    assert.equal(await pickName({ name: '  Pizza Hut  ' }), 'Pizza Hut');
});

test('onDemandDisplayText is preferred over displayText and name', async () => {
    ctx.installServices();
    assert.equal(
        await pickName({
            name:           'Raw Name',
            conceptOptions: { onDemandDisplayText: 'On Demand Name', displayText: 'In-Store Name' },
        }),
        'On Demand Name',
    );
});

test('displayText is preferred over name when onDemandDisplayText is whitespace', async () => {
    ctx.installServices();
    assert.equal(
        await pickName({
            name:           'Raw Name',
            conceptOptions: { onDemandDisplayText: '   ', displayText: 'In-Store Name' },
        }),
        'In-Store Name',
    );
});

test('displayText is preferred over name when onDemandDisplayText is missing', async () => {
    ctx.installServices();
    assert.equal(
        await pickName({
            name:           'Raw Name',
            conceptOptions: { displayText: 'In-Store Name' },
        }),
        'In-Store Name',
    );
});

test('station.name is used when both conceptOptions fields are empty/whitespace', async () => {
    ctx.installServices();
    assert.equal(
        await pickName({
            name:           'Raw Name',
            conceptOptions: { onDemandDisplayText: '', displayText: '   ' },
        }),
        'Raw Name',
    );
});

test('cafe name fallback when every option is whitespace', async () => {
    ctx.installServices();
    assert.equal(
        await pickName({
            name:           '   ',
            conceptOptions: { onDemandDisplayText: '', displayText: '   ' },
        }),
        STATION_TEST_CAFE.name,
    );
});

test('conceptOptions values are trimmed before being returned', async () => {
    ctx.installServices();
    assert.equal(
        await pickName({
            name:           'Raw Name',
            conceptOptions: { onDemandDisplayText: '  Trimmed Concept  ' },
        }),
        'Trimmed Concept',
    );
});

interface StationOverride {
    name?: string;
    conceptOptions?: {
        onDemandDisplayText?: string;
        displayText?: string;
    };
}

function buildStationFixture(override: StationOverride): unknown {
    const station: Record<string, unknown> = {
        id:               'station-x',
        name:             override.name ?? 'Station X',
        priceLevelConfig: { menuId: 'menu-x' },
        menus:            [
            {
                id:             'menu-x',
                name:           'Menu',
                categories:     [],
                lastUpdateTime: '2025-01-01T00:00:00.000Z',
            },
        ],
        availableAt: { open: '7:00 AM', close: '3:00 PM' },
    };
    if (override.conceptOptions !== undefined) {
        station.conceptOptions = override.conceptOptions;
    }
    return station;
}

/**
 * Seeds the station fixture for the test cafe, runs the real menu sync, and
 * returns the resolved station name. Asserts exactly one station came back
 * so callers can read `[0].name` without guarding for empty.
 */
async function pickName(override: StationOverride): Promise<string> {
    ctx.server.setFixture(STATION_TEST_CAFE_ID, 'stations', [buildStationFixture(override)]);

    const result = await CafeMenuSession.retrieveMenuAsync(STATION_TEST_CAFE, 0);
    assert.equal(result.stations.length, 1, 'expected exactly one station in the result');
    return result.stations[0]!.name;
}
