/**
 * End-to-end test for the Tag data service.
 *
 * Drives `services.data.tag.*` (the main-side typed client) which routes
 * through the InProcessHandler to `tagServiceCommands` and finally to
 * `TagStorageClient`. Verifies the service-layer wiring, Map→Record
 * conversion at the boundary, and duplicate-tag tolerance.
 */

import { after, before, test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../../tests/test-server/integration-test-context.js';
import { getServices } from '../../../../main/services/registry.js';
import { tagService } from '../../../../main/services/data/tag.js';
import { TagStorageClient } from './tags.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
    ctx.installServices();
});

after(async () => {
    await ctx.cleanup();
});

test('services.data.tag is the typed client (not the storage class)', () => {
    assert.equal(getServices().data.tag, tagService);
});

test('retrieveTags returns empty object when no tags exist', async () => {
    ctx.installServices();
    TagStorageClient.resetCache();

    const tags = await getServices().data.tag.retrieveTags({});
    assert.deepEqual(tags, {});
});

test('createTags + retrieveTags round-trip through the data handler', async () => {
    ctx.installServices();
    TagStorageClient.resetCache();

    await getServices().data.tag.createTags({
        tags: [
            { id: 'tag-1', name: 'Vegan' },
            { id: 'tag-2', name: 'Gluten Free' },
        ],
    });

    const tags = await getServices().data.tag.retrieveTags({});

    // The service returns Record<string, string>, not a Map.
    assert.equal(typeof tags, 'object');
    assert.equal(tags['tag-1'], 'Vegan');
    assert.equal(tags['tag-2'], 'Gluten Free');
});

test('createTags silently ignores duplicate tag ids', async () => {
    ctx.installServices();
    TagStorageClient.resetCache();

    await getServices().data.tag.createTags({
        tags: [{ id: 'dup-1', name: 'Original' }],
    });

    // Insert again with a different name — should be silently ignored.
    await getServices().data.tag.createTags({
        tags: [{ id: 'dup-1', name: 'Changed' }],
    });

    const tags = await getServices().data.tag.retrieveTags({});
    assert.equal(tags['dup-1'], 'Original', 'duplicate create must not overwrite');
});

test('TagStorageClient direct calls remain functional', async () => {
    ctx.installServices();
    TagStorageClient.resetCache();

    await TagStorageClient.createTags([{ id: 'direct-1', name: 'DirectTag' }]);
    const map = await TagStorageClient.retrieveTagsAsync();
    assert.ok(map instanceof Map, 'direct API returns a Map');
    assert.equal(map.get('direct-1'), 'DirectTag');
});
