import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../../main/services/registry.js';
import { stationThemeService } from '../../../../../main/services/data/station-theme.js';
import type { IMenuItemBase } from '@msdining/common/models/cafe';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

test('services.data.stationTheme is the typed client (not the storage class)', () => {
    assert.equal(getServices().data.stationTheme, stationThemeService);
});

test('retrieveTheme returns undefined for empty itemsByCategory', async () => {
    const theme = await getServices().data.stationTheme.retrieveTheme({
        stationName: 'Empty Station',
        itemsByCategory: new Map<string, IMenuItemBase[]>(),
    });

    assert.equal(theme, undefined);
});
