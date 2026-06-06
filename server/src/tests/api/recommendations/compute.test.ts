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
    entityKey:   `name:${overrides.menuItemId}`,
    ...overrides,
});

describe('applyWeights', () => {
    const popular = RecommendationSectionType.popular;
    const trySomethingDifferent = RecommendationSectionType.trySomethingDifferent;

    it('returns items unchanged when both weight maps are null', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const result = applyWeights(items, popular, { proximityWeights: null, itemWeights: null });
        assert.equal(result, items);
    });

    it('skips weighting for newAtFavorites (exempt)', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const result = applyWeights(items, RecommendationSectionType.newAtFavorites, {
            proximityWeights: new Map([['cafe-1', 0.5]]),
            itemWeights:      new Map([['a', 0.25]]),
        });
        assert.equal(result, items);
    });

    it('skips weighting for favorites (exempt)', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const result = applyWeights(items, RecommendationSectionType.favorites, {
            proximityWeights: null,
            itemWeights:      new Map([['a', 0.25]]),
        });
        assert.equal(result, items);
    });

    it('multiplies proximity weight into score', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const result = applyWeights(items, popular, {
            proximityWeights: new Map([['cafe-1', 0.5]]),
            itemWeights:      null,
        });
        assert.equal(result[0]!.score, 5);
    });

    it('multiplies item weight into score', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const result = applyWeights(items, popular, {
            proximityWeights: null,
            itemWeights:      new Map([['a', 0.75]]),
        });
        assert.equal(result[0]!.score, 7.5);
    });

    it('multiplies proximity and item weight together', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 })];
        const result = applyWeights(items, popular, {
            proximityWeights: new Map([['cafe-1', 0.5]]),
            itemWeights:      new Map([['a', 0.75]]),
        });
        assert.equal(result[0]!.score, 10 * 0.5 * 0.75);
    });

    it('drops items whose cafe has proximity weight 0', () => {
        const items = [
            makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 }),
            makeItem({ menuItemId: 'b', cafeId: 'cafe-2', score: 8 }),
        ];
        const result = applyWeights(items, popular, {
            proximityWeights: new Map([['cafe-1', 0], ['cafe-2', 1]]),
            itemWeights:      null,
        });
        assert.equal(result.length, 1);
        assert.equal(result[0]!.menuItemId, 'b');
    });

    it('uses default weight 1 for items/cafes missing from the maps', () => {
        const items = [
            makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10 }),
            makeItem({ menuItemId: 'b', cafeId: 'cafe-2', score: 8 }),
        ];
        const result = applyWeights(items, popular, {
            proximityWeights: new Map([['cafe-1', 0.5]]),
            itemWeights:      new Map([['b', 0.5]]),
        });
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
        const result = applyWeights(items, popular, {
            proximityWeights: null,
            itemWeights:      new Map([['b', 2.0]]),
        });
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
        const result = applyWeights(items, popular, {
            proximityWeights: new Map([['cafe-1', 1], ['cafe-2', 1]]),
            itemWeights:      new Map(),
        });
        assert.equal(result[0]!.menuItemId, 'a');
        assert.equal(result[1]!.menuItemId, 'b');
    });

    it('boosts items the user has ordered before via orderCountsByEntityKey', () => {
        const items = [
            makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10, entityKey: 'name:burger' }),
            makeItem({ menuItemId: 'b', cafeId: 'cafe-2', score: 10, entityKey: 'name:salad' }),
        ];
        // count=3 ⇒ 1 + log(4)*0.3 ≈ 1.4159; count=0 ⇒ 1
        const result = applyWeights(items, popular, {
            proximityWeights:       null,
            itemWeights:            null,
            orderCountsByEntityKey: new Map([['name:burger', 3]]),
        });
        assert.equal(result.length, 2);
        assert.equal(result[0]!.menuItemId, 'a', 'previously-ordered item should sort first');
        assert.ok(Math.abs(result[0]!.score - 10 * (1 + Math.log(4) * 0.3)) < 1e-9);
        assert.equal(result[1]!.menuItemId, 'b');
        assert.equal(result[1]!.score, 10);
    });

    it('combines order-history boost with proximity and item weights', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10, entityKey: 'name:burger' })];
        const result = applyWeights(items, popular, {
            proximityWeights:       new Map([['cafe-1', 0.5]]),
            itemWeights:            new Map([['a', 0.5]]),
            orderCountsByEntityKey: new Map([['name:burger', 3]]),
        });
        const expectedBoost = 1 + Math.log(4) * 0.3;
        assert.ok(Math.abs(result[0]!.score - 10 * 0.5 * 0.5 * expectedBoost) < 1e-9);
    });

    it('does not apply order-history boost to exempt section types', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10, entityKey: 'name:burger' })];
        const result = applyWeights(items, RecommendationSectionType.favorites, {
            proximityWeights:       null,
            itemWeights:            null,
            orderCountsByEntityKey: new Map([['name:burger', 5]]),
        });
        // Same array passed through, score untouched.
        assert.equal(result, items);
    });

    it('order-history boost is 1× for items the user has never ordered', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10, entityKey: 'name:burger' })];
        const result = applyWeights(items, popular, {
            proximityWeights:       null,
            itemWeights:            null,
            orderCountsByEntityKey: new Map([['name:other', 3]]),
        });
        // No matching entityKey ⇒ multiplier 1 ⇒ score unchanged.
        assert.equal(result.length, 1);
        assert.equal(result[0]!.score, 10);
    });

    it('does NOT boost trySomethingDifferent items via orderCountsByEntityKey', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10, entityKey: 'name:burger' })];
        const result = applyWeights(items, trySomethingDifferent, {
            proximityWeights:       null,
            itemWeights:            null,
            orderCountsByEntityKey: new Map([['name:burger', 5]]),
        });
        // The order-history boost is suppressed for this section; without a
        // familiar-key match the score should remain unchanged.
        assert.equal(result.length, 1);
        assert.equal(result[0]!.score, 10);
    });

    it('heavily demotes trySomethingDifferent items in familiarEntityKeys', () => {
        const items = [
            makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10, entityKey: 'name:burger' }),
            makeItem({ menuItemId: 'b', cafeId: 'cafe-2', score: 5, entityKey: 'name:salad' }),
        ];
        const result = applyWeights(items, trySomethingDifferent, {
            proximityWeights:   null,
            itemWeights:        null,
            familiarEntityKeys: new Set(['name:burger']),
        });
        // burger gets 0.1× penalty ⇒ score 1; salad untouched ⇒ score 5.
        // After re-sort: salad first.
        assert.equal(result.length, 2);
        assert.equal(result[0]!.menuItemId, 'b');
        assert.equal(result[0]!.score, 5);
        assert.equal(result[1]!.menuItemId, 'a');
        assert.ok(Math.abs(result[1]!.score - 1) < 1e-9);
    });

    it('trySomethingDifferent penalty does NOT touch other sections', () => {
        const items = [makeItem({ menuItemId: 'a', cafeId: 'cafe-1', score: 10, entityKey: 'name:burger' })];
        const result = applyWeights(items, popular, {
            proximityWeights:   null,
            itemWeights:        null,
            familiarEntityKeys: new Set(['name:burger']),
        });
        // popular section ignores familiarEntityKeys; with no other weights provided
        // the function short-circuits to a pass-through.
        assert.equal(result, items);
    });
});
