import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { IMenuItemBase, IMenuItemModifier, IMenuItemModifierChoice } from '@msdining/common/models/cafe';
import {
    getMinRequiredPrice,
    getModifierMinCost,
    hasModifierPriceBeyondMinimum,
} from '../../src/util/cart.ts';

const makeChoice = (id: string, price: number): IMenuItemModifierChoice => ({
    id,
    description: id,
    price,
});

const makeModifier = (overrides: Partial<IMenuItemModifier> & { choices: IMenuItemModifierChoice[] }): IMenuItemModifier => ({
    id:          'mod-1',
    description: 'Modifier',
    minimum:     1,
    maximum:     1,
    choiceType:  'radio',
    ...overrides,
});

const makeMenuItem = (price: number, modifiers: IMenuItemModifier[] = []): IMenuItemBase => ({
    id:           'item-1',
    cafeId:       'cafe-1',
    stationId:    'station-1',
    price,
    name:         'Test Item',
    calories:     0,
    maxCalories:  0,
    hasThumbnail: false,
    modifiers,
    tags:         new Set(),
    searchTags:   new Set(),
});

describe('getModifierMinCost', () => {
    it('returns 0 for optional modifier', () => {
        const modifier = makeModifier({
            minimum: 0,
            maximum: 3,
            choices: [makeChoice('a', 0.50), makeChoice('b', 0.75)],
        });
        assert.strictEqual(getModifierMinCost(modifier), 0);
    });

    it('returns cheapest price for min=1 required modifier', () => {
        const modifier = makeModifier({
            minimum: 1,
            maximum: 1,
            choices: [makeChoice('a', 0.75), makeChoice('b', 0.50), makeChoice('c', 1.25)],
        });
        assert.strictEqual(getModifierMinCost(modifier), 0.50);
    });

    it('returns sum of N cheapest for min>1', () => {
        const modifier = makeModifier({
            minimum:    2,
            maximum:    3,
            choiceType: 'checkbox',
            choices:    [makeChoice('a', 0.25), makeChoice('b', 0.75), makeChoice('c', 0.50)],
        });
        assert.strictEqual(getModifierMinCost(modifier), 0.75); // 0.25 + 0.50
    });

    it('returns 0 for empty choices', () => {
        const modifier = makeModifier({ minimum: 1, maximum: 1, choices: [] });
        assert.strictEqual(getModifierMinCost(modifier), 0);
    });
});

describe('getMinRequiredPrice', () => {
    it('returns base price when no modifiers', () => {
        const item = makeMenuItem(5.00);
        assert.strictEqual(getMinRequiredPrice(item), 5.00);
    });

    it('adds required modifier min cost to base price', () => {
        const item = makeMenuItem(5.00, [
            makeModifier({
                minimum: 1,
                maximum: 1,
                choices: [makeChoice('small', 0.50), makeChoice('medium', 0.75), makeChoice('large', 1.25)],
            }),
        ]);
        assert.strictEqual(getMinRequiredPrice(item), 5.50);
    });

    it('ignores optional modifiers', () => {
        const item = makeMenuItem(5.00, [
            makeModifier({
                minimum: 0,
                maximum: 3,
                choices: [makeChoice('a', 1.00), makeChoice('b', 2.00)],
            }),
        ]);
        assert.strictEqual(getMinRequiredPrice(item), 5.00);
    });

    it('sums multiple required modifiers', () => {
        const item = makeMenuItem(5.00, [
            makeModifier({
                id:      'size',
                minimum: 1,
                maximum: 1,
                choices: [makeChoice('small', 0.50), makeChoice('large', 1.00)],
            }),
            makeModifier({
                id:      'milk',
                minimum: 1,
                maximum: 1,
                choices: [makeChoice('whole', 0.00), makeChoice('oat', 0.30)],
            }),
        ]);
        assert.strictEqual(getMinRequiredPrice(item), 5.50); // 5 + 0.50 + 0.00
    });
});

describe('hasModifierPriceBeyondMinimum', () => {
    it('returns false when no modifiers', () => {
        assert.strictEqual(hasModifierPriceBeyondMinimum(makeMenuItem(5.00)), false);
    });

    it('returns true when optional modifier has priced choices', () => {
        const item = makeMenuItem(5.00, [
            makeModifier({
                minimum: 0,
                maximum: 1,
                choices: [makeChoice('extra', 0.50)],
            }),
        ]);
        assert.strictEqual(hasModifierPriceBeyondMinimum(item), true);
    });

    it('returns false when optional modifier has only free choices', () => {
        const item = makeMenuItem(5.00, [
            makeModifier({
                minimum: 0,
                maximum: 1,
                choices: [makeChoice('a', 0), makeChoice('b', 0)],
            }),
        ]);
        assert.strictEqual(hasModifierPriceBeyondMinimum(item), false);
    });

    it('returns true when required modifier has different prices', () => {
        const item = makeMenuItem(5.00, [
            makeModifier({
                minimum: 1,
                maximum: 1,
                choices: [makeChoice('small', 0.50), makeChoice('large', 1.00)],
            }),
        ]);
        assert.strictEqual(hasModifierPriceBeyondMinimum(item), true);
    });

    it('returns false when required modifier has all same prices', () => {
        const item = makeMenuItem(5.00, [
            makeModifier({
                minimum: 1,
                maximum: 1,
                choices: [makeChoice('a', 0.50), makeChoice('b', 0.50)],
            }),
        ]);
        assert.strictEqual(hasModifierPriceBeyondMinimum(item), false);
    });

    it('returns true when required modifier allows extra selections with non-zero price', () => {
        const item = makeMenuItem(5.00, [
            makeModifier({
                minimum:    1,
                maximum:    3,
                choiceType: 'checkbox',
                choices:    [makeChoice('a', 0.50), makeChoice('b', 0.50), makeChoice('c', 0.50)],
            }),
        ]);
        assert.strictEqual(hasModifierPriceBeyondMinimum(item), true);
    });
});
