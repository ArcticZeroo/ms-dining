import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { parseIngredientsMenu } from '../../components/cafes/station/ingredients-menu-parsing.ts';
import { ICafeStation } from '../../models/cafe.ts';
import { IMenuItem, IMenuItemModifier } from '@msdining/common/models/cafe';

const makeModifier = (description: string, choices: string[]): IMenuItemModifier => ({
    id:          `mod-${description}`,
    description,
    minimum:     1,
    maximum:     1,
    choiceType:  'radio',
    choices:     choices.map(name => ({ id: `choice-${name}`, description: name, price: 0 })),
});

const makeMenuItem = (overrides: Partial<IMenuItem> & { id: string; name: string }): IMenuItem => ({
    totalReviewCount:        0,
    overallRating:           0,
    cafeId:                  'in-gredients',
    stationId:               '4373',
    price:                   0,
    calories:                0,
    maxCalories:             0,
    hasThumbnail:            false,
    modifiers:               [],
    tags:                    new Set(),
    searchTags:              new Set(),
    firstAppearance:         '2024-01-01',
    ...overrides,
});

const makeMockIngredientsStation = (): ICafeStation => ({
    name:    'in.gredients.',
    logoUrl: 'https://example.com/logo.png',
    menu:    {
        '3 Course Meal': [
            makeMenuItem({
                id:        'entree-1',
                name:      'Vegan Lasagna',
                price:     25,
                modifiers: [
                    makeModifier('Starter Choice:', ['Five Onion Soup', 'Sesame-Peppercorn Crusted Ahi*']),
                    makeModifier('Dessert Choice:', ['Roasted Asiago-Blue Cheese Stuffed Red Potatoes', 'Flourless Chocolate Cake']),
                ],
            }),
            makeMenuItem({
                id:        'entree-2',
                name:      'Steak Frites*',
                price:     25,
                modifiers: [
                    makeModifier('Starter Choice:', ['Five Onion Soup', 'Sesame-Peppercorn Crusted Ahi*']),
                    makeModifier('Dessert Choice:', ['Roasted Asiago-Blue Cheese Stuffed Red Potatoes', 'Flourless Chocolate Cake']),
                    makeModifier('Temp Choice:', ['Rare', 'Medium Rare', 'Medium']),
                ],
            }),
        ],
        'À la carte Menu': [
            makeMenuItem({ id: 'alc-soup', name: 'Five Onion Soup', price: 6.5 }),
            makeMenuItem({ id: 'alc-ahi', name: 'Sesame-Peppercorn Crusted Ahi*', price: 6.5 }),
            makeMenuItem({ id: 'alc-lasagna', name: 'Vegan Lasagna - À la carte', price: 18 }),
            makeMenuItem({ id: 'alc-steak', name: 'Steak Frites* - À la carte', price: 18 }),
            makeMenuItem({
                id:          'alc-sweet',
                name:        'Sweet',
                price:       6.5,
                description: 'Flourless Chocolate Cake, Crème Anglaise, Chocolate Dome, Hot Caramel Sauce, Black Sea Salt',
            }),
            makeMenuItem({
                id:          'alc-savory',
                name:        'Savory',
                price:       6.5,
                description: 'Roasted Asiago-Blue Cheese Stuffed Red Potatoes, Chive',
            }),
        ],
        'Additional Offerings': [
            makeMenuItem({ id: 'add-bread', name: 'Black Pepper-Gruyeré Parmesan Gougeré (3 pcs)', price: 4.75 }),
            makeMenuItem({ id: 'add-mocktail', name: 'Mocktail', price: 5.75 }),
        ],
    },
    uniqueness: {
        isTraveling:              false,
        daysThisWeek:             5,
        itemDays:                 { 1: 0, 5: 20 },
        theme:                    undefined,
        themeItemIds:             [],
        firstAppearance:          '2023-10-30',
        recentlyAvailableItemCount: 0,
    },
});

describe('parseIngredientsMenu', () => {
    it('returns null for empty stations', () => {
        assert.strictEqual(parseIngredientsMenu([]), null);
    });

    it('returns null for multiple stations', () => {
        const station = makeMockIngredientsStation();
        assert.strictEqual(parseIngredientsMenu([station, station]), null);
    });

    it('returns null when no 3 Course Meal category exists', () => {
        const station = makeMockIngredientsStation();
        delete (station.menu as Record<string, unknown>)['3 Course Meal'];
        assert.strictEqual(parseIngredientsMenu([station]), null);
    });

    it('returns null when no starter/dessert modifiers found', () => {
        const station = makeMockIngredientsStation();
        for (const item of station.menu['3 Course Meal']!) {
            item.modifiers = [];
        }
        assert.strictEqual(parseIngredientsMenu([station]), null);
    });

    it('parses a valid in.gredients menu correctly', () => {
        const station = makeMockIngredientsStation();
        const result = parseIngredientsMenu([station]);

        assert.notStrictEqual(result, null);
        assert.strictEqual(result!.price, 25);
        assert.strictEqual(result!.logoUrl, 'https://example.com/logo.png');

        // Entrées
        assert.strictEqual(result!.mainChoices.length, 2);
        assert.strictEqual(result!.mainChoices[0]!.name, 'Vegan Lasagna');
        assert.strictEqual(result!.mainChoices[1]!.name, 'Steak Frites*');

        // Starters - matched from modifier choices to à la carte items
        assert.strictEqual(result!.starterChoices.length, 2);
        const starterNames = result!.starterChoices.map(s => s.name);
        assert.ok(starterNames.includes('Five Onion Soup'), `Expected 'Five Onion Soup' in starters, got: ${starterNames}`);
        assert.ok(starterNames.includes('Sesame-Peppercorn Crusted Ahi*'), `Expected 'Sesame-Peppercorn Crusted Ahi*' in starters, got: ${starterNames}`);

        // Desserts - matched via description containment
        assert.strictEqual(result!.dessertChoices.length, 2);
        const dessertNames = result!.dessertChoices.map(d => d.name);
        assert.ok(dessertNames.includes('Sweet'), `Expected 'Sweet' in desserts, got: ${dessertNames}`);
        assert.ok(dessertNames.includes('Savory'), `Expected 'Savory' in desserts, got: ${dessertNames}`);

        // Additional offerings should include non-course items but NOT à la carte entrees
        const additionalNames = result!.additionalOfferings.map(a => a.name);
        assert.ok(additionalNames.includes('Black Pepper-Gruyeré Parmesan Gougeré (3 pcs)'));
        assert.ok(additionalNames.includes('Mocktail'));
        assert.ok(!additionalNames.includes('Vegan Lasagna - À la carte'), 'Should not include à la carte entrees');
        assert.ok(!additionalNames.includes('Steak Frites* - À la carte'), 'Should not include à la carte entrees');
        assert.ok(!additionalNames.includes('Five Onion Soup'), 'Should not include matched starters');
        assert.ok(!additionalNames.includes('Sweet'), 'Should not include matched desserts');
    });

    it('handles slightly different modifier choice names (fuzzy matching)', () => {
        const station = makeMockIngredientsStation();
        // Change modifier choice name to differ slightly from à la carte
        station.menu['3 Course Meal']![0]!.modifiers[0]!.choices[0]!.description = 'Five Onion Soup ';
        const result = parseIngredientsMenu([station]);
        assert.notStrictEqual(result, null);
        assert.strictEqual(result!.starterChoices.length, 2);
    });

    it('still returns a result even when some choices cannot be matched', () => {
        const station = makeMockIngredientsStation();
        // Add an unmatched modifier choice
        station.menu['3 Course Meal']![0]!.modifiers[0]!.choices.push({
            id:          'choice-unknown',
            description: 'Completely Unknown Dish',
            price:       0,
        });
        const result = parseIngredientsMenu([station]);
        assert.notStrictEqual(result, null);
        // Only the 2 matching starters should appear
        assert.strictEqual(result!.starterChoices.length, 2);
    });

    it('finds modifiers from a later entree when the first entree lacks them', () => {
        const station = makeMockIngredientsStation();
        // Remove modifiers from the first entree entirely
        station.menu['3 Course Meal']![0]!.modifiers = [];
        const result = parseIngredientsMenu([station]);
        assert.notStrictEqual(result, null);
        // Should still find starters/desserts from the second entree's modifiers
        assert.strictEqual(result!.starterChoices.length, 2);
        assert.strictEqual(result!.dessertChoices.length, 2);
        assert.strictEqual(result!.mainChoices.length, 2);
    });

    it('finds starter from one entree and dessert from another', () => {
        const station = makeMockIngredientsStation();
        // First entree only has starter modifier
        station.menu['3 Course Meal']![0]!.modifiers = [
            makeModifier('Starter Choice:', ['Five Onion Soup', 'Sesame-Peppercorn Crusted Ahi*']),
        ];
        // Second entree only has dessert modifier
        station.menu['3 Course Meal']![1]!.modifiers = [
            makeModifier('Dessert Choice:', ['Roasted Asiago-Blue Cheese Stuffed Red Potatoes', 'Flourless Chocolate Cake']),
        ];
        const result = parseIngredientsMenu([station]);
        assert.notStrictEqual(result, null);
        assert.strictEqual(result!.starterChoices.length, 2);
        assert.strictEqual(result!.dessertChoices.length, 2);
    });

    it('returns null when fewer than 2 starters match (bad data entry)', () => {
        const station = makeMockIngredientsStation();
        // Replace one starter choice with something that won't match any à la carte item
        station.menu['3 Course Meal']![0]!.modifiers[0]!.choices[0]!.description = 'Sausage-Lentil Soup';
        station.menu['3 Course Meal']![1]!.modifiers[0]!.choices[0]!.description = 'Sausage-Lentil Soup';
        const result = parseIngredientsMenu([station]);
        assert.strictEqual(result, null);
    });

    it('returns null when fewer than 2 desserts match (bad data entry)', () => {
        const station = makeMockIngredientsStation();
        // Replace one dessert choice with something that won't match
        station.menu['3 Course Meal']![0]!.modifiers[1]!.choices[0]!.description = 'Mystery Dessert';
        station.menu['3 Course Meal']![1]!.modifiers[1]!.choices[0]!.description = 'Mystery Dessert';
        const result = parseIngredientsMenu([station]);
        assert.strictEqual(result, null);
    });
});
