import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	computeDrinkWeight,
	computeNoveltyWeight,
	DRINK_WEIGHT,
	isDrink,
	TRAVELING_WEIGHT,
} from '../../../api/recommendations/item-weights.js';
import { IMenuItemBase } from '@msdining/common/models/cafe';

const makeMenuItem = (overrides: Partial<IMenuItemBase> = {}): IMenuItemBase => ({
    id:          'item-1',
    name:        'Test Item',
    cafeId:      'cafe-1',
    stationId:   'station-1',
    price:       5.99,
    calories:    300,
    maxCalories: 300,
    hasThumbnail: false,
    modifiers:   [],
    tags:        new Set(),
    searchTags:  new Set(),
    ...overrides,
});

describe('isDrink', () => {
    it('detects drinks by AI search tag (beverage)', () => {
        const item = makeMenuItem({ name: 'Latte', searchTags: new Set(['beverage', 'coffee']) });
        assert.equal(isDrink(item, 'Espresso Bar'), true);
    });

    it('detects drinks by station name when tags are missing', () => {
        const item = makeMenuItem({ name: 'House Blend', searchTags: new Set() });
        assert.equal(isDrink(item, 'Coffee'), true);
    });

    it('does not detect food items as drinks (no tag, no drink-named station)', () => {
        const item = makeMenuItem({ name: 'Cheeseburger', searchTags: new Set(['burger', 'beef']) });
        assert.equal(isDrink(item, 'Grill'), false);
    });

    it('does not false-positive on station names that only contain a drink substring', () => {
        // "Steakhouse" contains "tea" as a substring; word-boundary match should reject.
        const item = makeMenuItem({ name: 'Steak', searchTags: new Set(['beef']) });
        assert.equal(isDrink(item, 'Steakhouse'), false);
    });
});

describe('computeDrinkWeight', () => {
    it('returns DRINK_WEIGHT for drinks', () => {
        const item = makeMenuItem({ searchTags: new Set(['beverage']) });
        assert.equal(computeDrinkWeight(item, 'Coffee'), DRINK_WEIGHT);
    });

    it('returns 1 for non-drinks', () => {
        const item = makeMenuItem({ searchTags: new Set(['burger']) });
        assert.equal(computeDrinkWeight(item, 'Grill'), 1);
    });

    it('DRINK_WEIGHT is a 25% penalty', () => {
        assert.equal(DRINK_WEIGHT, 0.75);
    });
});

describe('computeNoveltyWeight', () => {
    it('boosts items appearing 1 day this week (most novel)', () => {
        assert.ok(computeNoveltyWeight(1, false) > 1);
    });

    it('slightly boosts items appearing 2 days this week', () => {
        assert.ok(computeNoveltyWeight(2, false) > 1);
        assert.ok(computeNoveltyWeight(2, false) < computeNoveltyWeight(1, false));
    });

    it('returns 1 for items appearing 3 days this week (neutral)', () => {
        assert.equal(computeNoveltyWeight(3, false), 1);
    });

    it('penalizes items that appear 4 days this week', () => {
        assert.ok(computeNoveltyWeight(4, false) < 1);
    });

    it('penalizes items appearing every weekday more heavily than 4 days', () => {
        assert.ok(computeNoveltyWeight(5, false) < computeNoveltyWeight(4, false));
    });

    it('boosts items at traveling stations', () => {
        assert.equal(computeNoveltyWeight(3, true), TRAVELING_WEIGHT);
        assert.ok(computeNoveltyWeight(1, true) > computeNoveltyWeight(1, false));
    });

    it('multiplies traveling boost with day-count penalty', () => {
        const fiveDays = computeNoveltyWeight(5, false);
        const fiveDaysTraveling = computeNoveltyWeight(5, true);
        assert.ok(Math.abs(fiveDaysTraveling - fiveDays * TRAVELING_WEIGHT) < 1e-9);
    });

    it('defaults to 1 for unexpected day counts (defensive)', () => {
        assert.equal(computeNoveltyWeight(0, false), 1);
        assert.equal(computeNoveltyWeight(7, false), 1);
    });

    it('TRAVELING_WEIGHT is a 25% boost', () => {
        assert.equal(TRAVELING_WEIGHT, 1.25);
    });
});
