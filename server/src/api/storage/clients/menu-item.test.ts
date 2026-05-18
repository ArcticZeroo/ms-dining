/**
 * Tests for MenuItemStorageClient.
 *
 * Regression target `2ede4a1` / `45f57f7` — those fixes ensured that writing a
 * thumbnail hash also called `registerThumbnailHash` so that the in-process
 * canonical map immediately reflected the new hash (enabling dedup redirects
 * without requiring a server restart).
 *
 * NOTE: The thumbnail-canonicalization feature itself was removed from the
 * production code in commit `9a6ab9e` ("remove thumbnail canonicalization").
 * The methods `registerThumbnailHash`, `getCanonicalThumbnailId`, and
 * `loadThumbnailHashMap` no longer exist on `MenuItemStorageClient`, so the
 * regression assertions described in the original test brief (write hash →
 * resolvable via canonical lookup; dedup redirect without restart) can't be
 * implemented against the current code without resurrecting deleted APIs.
 *
 * The closest still-present contract on `updateThumbnailHash` is the P2025
 * swallow: the protection that allowed registerThumbnailHash to be called
 * safely on the live path. (Plain "persists the value you wrote" / "WHERE id
 * doesn't touch other rows" assertions were dropped — those test Prisma's
 * UPDATE semantics, not production code.)
 */

import { after, before, beforeEach, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { MenuItemStorageClient } from './menu-item.js';
import { usePrismaWrite } from '../client.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../../test-server/integration-test-context.js';

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
});

after(async () => {
    await ctx.cleanup();
});

beforeEach(async () => {
    // MenuItem rows have a FK back to Cafe + Station; deleting Cafe cascades
    // everything we seed here.
    await usePrismaWrite(c => c.cafe.deleteMany({}));
});

test('updateThumbnailHash silently swallows P2025 when the menu item was deleted', async () => {
    // No seeded row — the update target does not exist. Prisma raises P2025
    // and the production code is expected to treat it as a no-op so that
    // background thumbnail workers don't crash on items that were pruned
    // between scheduling and execution.
    await assert.doesNotReject(
        MenuItemStorageClient.updateThumbnailHash('does-not-exist', 'hash-xxx'),
        'orphaned-item updates must be silently ignored',
    );
});
