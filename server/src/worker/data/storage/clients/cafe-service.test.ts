/**
 * End-to-end test for the Cafe data service.
 *
 * Drives `services.data.cafe.*` through the InProcessHandler to
 * `cafeServiceCommands` and finally to `CafeStorageClient`. Verifies
 * the Map→Record conversion, null-vs-undefined normalization, and
 * round-trip create→retrieve flow.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../main/services/registry.js';
import { cafeService } from '../../../../main/services/data/cafe.js';
import { CafeStorageClient } from './cafe.js';
import type { ICafe, ICafeConfig } from '../../../../shared/models/cafe.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

const CAFE: ICafe = { id: 'test-cafe', name: 'Test Café' };
const CONFIG: ICafeConfig = {
    tenantId:         'tenant-1',
    contextId:        'ctx-1',
    displayProfileId: 'dp-1',
    storeId:          'store-1',
    externalName:     'External Café',
    logoName:         'logo.png',
    isShutDown:       false,
};

test('services.data.cafe is the typed client (not the storage class)', () => {
    assert.equal(getServices().data.cafe, cafeService);
});

test('retrieveCafe returns null for nonexistent id', async () => {
    CafeStorageClient.resetCache();
    const result = await getServices().data.cafe.retrieveCafe({ id: 'no-such-cafe' });
    assert.equal(result, null);
});

test('createCafe + retrieveCafe round-trip', async () => {
    CafeStorageClient.resetCache();

    await getServices().data.cafe.createCafe({ cafe: CAFE, config: CONFIG });

    const record = await getServices().data.cafe.retrieveCafe({ id: CAFE.id });
    assert.ok(record);
    assert.equal(record.id, CAFE.id);
    assert.equal(record.name, CAFE.name);
    assert.equal(record.tenantId, CONFIG.tenantId);
    assert.equal(record.logoName, CONFIG.logoName);
    assert.equal(record.storeId, CONFIG.storeId);
    assert.equal(record.externalName, CONFIG.externalName);
});

test('retrieveCafes returns Record<string, ICafeRecord>', async () => {
    // Don't reset cache — the cafe from the previous test should be present.

    const all = await getServices().data.cafe.retrieveCafes({});
    assert.equal(typeof all, 'object');
    assert.ok(!Array.isArray(all));
    assert.ok(all[CAFE.id], 'should contain the created cafe');
    assert.equal(all[CAFE.id]!.name, CAFE.name);
});

test('doesCafeExist returns true for existing cafe', async () => {
    const exists = await getServices().data.cafe.doesCafeExist({ id: CAFE.id });
    assert.equal(exists, true);
});

test('doesCafeExist returns false for nonexistent cafe', async () => {
    const exists = await getServices().data.cafe.doesCafeExist({ id: 'fake' });
    assert.equal(exists, false);
});
