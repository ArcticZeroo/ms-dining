import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyWeights } from '../../../worker/data/recommendations/compute.js';
import {
    IRecommendationItem,
    RecommendationSectionType,
} from '@msdining/common/models/recommendation';

const makeItem = (overrides: Partial<IRecommendationItem> & Pick<IRecommendationItem, 'menuItemId' | 'cafeId' | 'score'>): IRecommendationItem => ({
    name:        'Test',
    cafeName:    'Test Cafe',
    stationName: 'Test Station',
    price:       0,
    calories:    0,
    ...overrides,
});

describe('applyWeights', () => {
    const popular = RecommendationSectionType.popular;

    it('returns items unchanged when both weight maps are null', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const result = applyWeights(items, popular, null, null);
        assert.equal(result, items);
    });

    it('skips weighting for newAtFavorites (exempt)', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const proximityWeights = new Map([['cafe-1', 0.5]]);
        const itemWeights = new Map([['a', 0.25]]);
        const result = applyWeights(items, RecommendationSectionType.newAtFavorites, proximityWeights, itemWeights);
        assert.equal(result, items);
    });

    it('skips weighting for favorites (exempt)', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const itemWeights = new Map([['a', 0.25]]);
        const result = applyWeights(items, RecommendationSectionType.favorites, null, itemWeights);
        assert.equal(result, items);
    });

    it('multiplies proximity weight into score', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const result = applyWeights(items, popular, new Map([['cafe-1', 0.5]]), null);
        assert.equal(result[0]!.score, 5);
    });

    it('multiplies item weight into score', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const result = applyWeights(items, popular, null, new Map([['a', 0.75]]));
        assert.equal(result[0]!.score, 7.5);
    });

    it('multiplies proximity and item weight together', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const result = applyWeights(items, popular, new Map([['cafe-1', 0.5]]), new Map([['a', 0.75]]));
        assert.equal(result[0]!.score, 10 * 0.5 * 0.75);
    });

    it('drops items whose cafe has proximity weight 0', () => {
        const items = [
            makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 }),
            makeItem({ menuItemId: 'b', cafeId: 'cafe-2', score: 8 }),
        ];
        const result = applyWeights(items, popular, new Map([['cafe-1', 0], ['cafe-2', 1]]), null);
        assert.equal(result.length, 1);
        assert.equal(result[0]!.menuItemId, 'b');
    });

    it('uses default weight 1 for items/cafes missing from the maps', () => {
        const items = [
            makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 }),
            makeItem({ menuItemId: 'b', cafeId: 'cafe-2', score: 8 }),
        ];
        const result = applyWeights(items, popular, new Map([['cafe-1', 0.5]]), new Map([['b', 0.5]]));
        // a: 10 * 0.5 * 1 = 5;  b: 8 * 1 * 0.5 = 4. After sort: [a=5, b=4]
        assert.equal(result.length, 2);
        assert.equal(result[0]!.menuItemId, 'a');
        assert.equal(result[0]!.score, 5);
        assert.equal(result[1]!.menuItemId, 'b');
        assert.equal(result[1]!.score, 4);
    });

    it('re-sorts by score when any weight changed', () => {
        const items = [
            makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 }),
            makeItem({ menuItemId: 'b', cafeId: 'cafe-2', score: 8 }),
        ];
        // Boost b enough to overtake a
        const result = applyWeights(items, popular, null, new Map([['b', 2.0]]));
        assert.equal(result[0]!.menuItemId, 'b');
        assert.equal(result[0]!.score, 16);
        assert.equal(result[1]!.menuItemId, 'a');
        assert.equal(result[1]!.score, 10);
    });

    it('preserves original order when all effective weights are 1', () => {
        const items = [
            makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 }),
            makeItem({ menuItemId: 'b', cafeId: 'cafe-2', score: 8 }),
        ];
        const result = applyWeights(items, popular, new Map([['cafe-1', 1], ['cafe-2', 1]]), new Map());
        assert.equal(result[0]!.menuItemId, 'a');
        assert.equal(result[1]!.menuItemId, 'b');
    });
});
