/**
 * Unit tests for pickStationName (exercised via retrieveStationListAsync).
 *
 * pickStationName is a module-local helper, so we drive it indirectly by
 * giving retrieveStationListAsync a stub BuyOnDemandClient whose requestAsync
 * returns a canned station-list JSON. This keeps the test fully synchronous
 * with no DB / fixture / network dependencies.
 *
 * Regression target: 03cce02 — switch station name being just a space.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { Response } from 'node-fetch';
import { BuyOnDemandClient } from './buy-ondemand-client.js';
import { retrieveStationListAsync } from './stations.js';
import { ICafe } from '../../../models/cafe.js';

interface StationOverride {
    name?: string;
    conceptOptions?: {
        onDemandDisplayText?: string;
        displayText?: string;
    };
}

class StubClient extends BuyOnDemandClient {
    private readonly _stationListJson: unknown[];

    constructor(cafe: ICafe, stationListJson: unknown[]) {
        super(cafe);
        this._stationListJson = stationListJson;
        this.config = {
            tenantId:         'stub-tenant',
            contextId:        'stub-context',
            displayProfileId: 'stub-profile',
            storeId:          'stub-store',
            externalName:     'Stub External',
            logoName:         'logo',
            isShutDown:       false,
            shutDownMessage:  undefined,
        };
    }

    public async requestAsync(_path: string, _options: any = {}, _shouldValidateSuccess: boolean = true): Promise<Response> {
        return new Response(JSON.stringify(this._stationListJson), {
            status:  200,
            headers: { 'content-type': 'application/json' },
        });
    }
}

function buildStationJson(override: StationOverride): unknown {
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

const TEST_CAFE: ICafe = {
    id:   'stub-cafe',
    name: 'Stub Cafe Display Name',
};

async function pickName(override: StationOverride): Promise<string> {
    const client = new StubClient(TEST_CAFE, [buildStationJson(override)]);
    const result = await retrieveStationListAsync(client, 0);
    assert.equal(result.stations.length, 1, 'expected exactly one station in the result');
    return result.stations[0]!.name;
}

test('whitespace-only station name falls back to cafe name', async () => {
    assert.equal(await pickName({ name: '   ' }), TEST_CAFE.name);
});

test('empty station name falls back to cafe name', async () => {
    assert.equal(await pickName({ name: '' }), TEST_CAFE.name);
});

test('normal station name is preserved', async () => {
    assert.equal(await pickName({ name: 'Pizza Hut' }), 'Pizza Hut');
});

test('station name is trimmed of leading/trailing whitespace', async () => {
    assert.equal(await pickName({ name: '  Pizza Hut  ' }), 'Pizza Hut');
});

test('onDemandDisplayText is preferred over displayText and name', async () => {
    assert.equal(
        await pickName({
            name:           'Raw Name',
            conceptOptions: { onDemandDisplayText: 'On Demand Name', displayText: 'In-Store Name' },
        }),
        'On Demand Name',
    );
});

test('displayText is preferred over name when onDemandDisplayText is whitespace', async () => {
    assert.equal(
        await pickName({
            name:           'Raw Name',
            conceptOptions: { onDemandDisplayText: '   ', displayText: 'In-Store Name' },
        }),
        'In-Store Name',
    );
});

test('displayText is preferred over name when onDemandDisplayText is missing', async () => {
    assert.equal(
        await pickName({
            name:           'Raw Name',
            conceptOptions: { displayText: 'In-Store Name' },
        }),
        'In-Store Name',
    );
});

test('station.name is used when both conceptOptions fields are empty/whitespace', async () => {
    assert.equal(
        await pickName({
            name:           'Raw Name',
            conceptOptions: { onDemandDisplayText: '', displayText: '   ' },
        }),
        'Raw Name',
    );
});

test('cafe name fallback when every option is whitespace', async () => {
    assert.equal(
        await pickName({
            name:           '   ',
            conceptOptions: { onDemandDisplayText: '', displayText: '   ' },
        }),
        TEST_CAFE.name,
    );
});

test('conceptOptions values are trimmed before being returned', async () => {
    assert.equal(
        await pickName({
            name:           'Raw Name',
            conceptOptions: { onDemandDisplayText: '  Trimmed Concept  ' },
        }),
        'Trimmed Concept',
    );
});
