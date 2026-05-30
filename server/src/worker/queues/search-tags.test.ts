/**
 * Regression tests for the search-tags worker queue — commit e0b6fa8
 * ("Fix bug causing existing tags to not be saved").
 *
 * Background:
 *   The worker normalizes the menu item's name, queries the DB for any
 *   existing SearchTag rows already associated with another item of the
 *   same normalized name, and either:
 *     (a) reuses those existing tags AND persists them to *this* item too,
 *         then returns QUEUE_SKIP_ENTRY so the runner skips the
 *         success-poll delay; or
 *     (b) falls back to the AI to generate new tags and persists those.
 *
 *   Pre-fix, the "existing tags" branch returned QUEUE_SKIP_ENTRY *before*
 *   calling saveMenuItemSearchTagsAsync, so the new item never received
 *   the shared tags. The fix moves the skip signal into a variable that is
 *   returned at the end, *after* the save.
 *
 * These tests drive SEARCH_TAG_WORKER_QUEUE.doWorkAsync directly through
 * the real Prisma + storage-client code paths using the integration
 * harness (so the MockAiProvider can observe whether the AI was invoked).
 */

import { after, afterEach, before, describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { usePrismaClient, usePrismaWrite } from '../data/storage/client.js';
import {
    createIntegrationTestContext,
    IntegrationTestContext,
} from '../../tests/test-server/integration-test-context.js';
import { SEARCH_TAG_WORKER_QUEUE } from './search-tags.js';

const CAFE_ID = 'search-tags-test-cafe';
const STATION_ID = 'search-tags-test-station';

const seedCafeAndStation = async (): Promise<void> => {
    await usePrismaWrite(async (client) => {
        await client.cafe.upsert({
            where:  { id: CAFE_ID },
            update: {},
            create: {
                id:               CAFE_ID,
                name:             'Search Tags Test Cafe',
                tenantId:         't',
                contextId:        'c',
                displayProfileId: 'dp',
            },
        });
        await client.station.upsert({
            where:  { id: STATION_ID },
            update: {},
            create: {
                id:             STATION_ID,
                name:           'Test Station',
                normalizedName: normalizeNameForSearch('Test Station'),
                menuId:         'menu-1',
                cafeId:         CAFE_ID,
            },
        });
    });
};

interface ISeedItem {
    id: string;
    name: string;
    /** When set, attaches these SearchTag rows to the item (creating them if needed). */
    searchTags?: string[];
}

const seedMenuItem = async (item: ISeedItem): Promise<void> => {
    await usePrismaWrite(async (client) => {
        await client.menuItem.upsert({
            where:  { id: item.id },
            update: {
                name:           item.name,
                normalizedName: normalizeNameForSearch(item.name),
                cafeId:         CAFE_ID,
                stationId:      STATION_ID,
            },
            create: {
                id:             item.id,
                name:           item.name,
                normalizedName: normalizeNameForSearch(item.name),
                description:    null,
                imageUrl:       null,
                price:          5.00,
                calories:       100,
                maxCalories:    100,
                cafeId:         CAFE_ID,
                stationId:      STATION_ID,
            },
        });

        if (item.searchTags && item.searchTags.length > 0) {
            await client.menuItem.update({
                where: { id: item.id },
                data:  {
                    searchTags: {
                        connectOrCreate: item.searchTags.map(name => ({
                            where:  { name },
                            create: { name },
                        })),
                    },
                },
            });
        }
    });
};

const getSearchTagsForItem = async (id: string): Promise<string[]> => {
    return usePrismaClient(async (client) => {
        const item = await client.menuItem.findUnique({
            where:   { id },
            include: { searchTags: { select: { name: true } } },
        });
        if (!item) {
            return [];
        }
        return item.searchTags.map(tag => tag.name).sort();
    });
};

let ctx: IntegrationTestContext;

before(async () => {
    ctx = await createIntegrationTestContext();
    await seedCafeAndStation();
}, { timeout: 60_000 });

after(async () => {
    await ctx.cleanup();
});

afterEach(() => {
    ctx.mockAi.clearCallLog();
});

describe('SEARCH_TAG_WORKER_QUEUE.doWorkAsync — existing tags branch (e0b6fa8)', () => {
    test('persists existing tags to a new item without calling the AI, and signals skip', async () => {
        // Item A already has tags. Item B shares the normalized name but has
        // none yet — that's the queue entry being processed.
        await seedMenuItem({
            id:         'tags-existing-source',
            name:       'Cheeseburger',
            searchTags: ['food', 'beef', 'sandwich'],
        });
        await seedMenuItem({
            id:   'tags-existing-target',
            name: 'Cheeseburger', // same normalized name as the source
        });

        const result = await SEARCH_TAG_WORKER_QUEUE.doWorkAsync({
            id:          'tags-existing-target',
            name:        'Cheeseburger',
            description: null,
        });

        // (1) AI was NOT consulted.
        const textCalls = ctx.mockAi.getTextCalls();
        assert.equal(textCalls.length, 0,
            `AI must not be called when existing tags are found, got ${textCalls.length} calls`);

        // (2) The target item received the existing tags. This is the
        //     regression — pre-fix the worker returned before the save, so
        //     the new item stayed tagless.
        const persisted = await getSearchTagsForItem('tags-existing-target');
        assert.deepEqual(persisted, ['beef', 'food', 'sandwich'],
            `target item must receive the existing tags; got [${persisted.join(', ')}]`);

        // (3) The queue entry is still marked "skip" so the runner advances
        //     immediately rather than waiting out the success-poll delay.
        assert.equal(typeof result, 'symbol',
            'doWorkAsync must return a symbol (QUEUE_SKIP_ENTRY) when reusing existing tags');
    });

    test('source item with the existing tags is not disturbed', async () => {
        // Sanity: reusing existing tags must not mutate the source's tags.
        await seedMenuItem({
            id:         'tags-source-protected',
            name:       'Veggie Wrap',
            searchTags: ['food', 'vegetarian'],
        });
        await seedMenuItem({
            id:   'tags-target-protected',
            name: 'Veggie Wrap',
        });

        const beforeSourceTags = await getSearchTagsForItem('tags-source-protected');

        await SEARCH_TAG_WORKER_QUEUE.doWorkAsync({
            id:          'tags-target-protected',
            name:        'Veggie Wrap',
            description: null,
        });

        const afterSourceTags = await getSearchTagsForItem('tags-source-protected');
        assert.deepEqual(afterSourceTags, beforeSourceTags,
            'source item tags must be unchanged after the worker reuses them');
    });
});

describe('SEARCH_TAG_WORKER_QUEUE.doWorkAsync — AI fallback branch', () => {
    test('calls the AI when no existing tags match the normalized name', async () => {
        // Inject a deterministic AI response so the assertion is stable.
        ctx.mockAi.setTextResponse(
            'search tags',
            'tasty, snack, treat',
        );

        await seedMenuItem({
            id:   'tags-no-existing',
            name: 'Mystery Item Alpha', // unique normalized name
        });

        const result = await SEARCH_TAG_WORKER_QUEUE.doWorkAsync({
            id:          'tags-no-existing',
            name:        'Mystery Item Alpha',
            description: 'A first-of-its-kind menu item.',
        });

        const textCalls = ctx.mockAi.getTextCalls();
        assert.equal(textCalls.length, 1,
            `AI must be invoked exactly once when no existing tags exist; got ${textCalls.length}`);
        assert.ok(
            textCalls[0]!.systemPrompt.toLowerCase().includes('search tag'),
            'invoking prompt must be the search-tags system prompt',
        );

        const persisted = await getSearchTagsForItem('tags-no-existing');
        assert.deepEqual(persisted, ['snack', 'tasty', 'treat'],
            `AI-returned tags must be persisted (sorted, normalized); got [${persisted.join(', ')}]`);

        // The AI-fallback branch returns undefined (no skip signal).
        assert.equal(result, undefined,
            'doWorkAsync should return undefined when the AI path produced fresh tags');
    });
});
