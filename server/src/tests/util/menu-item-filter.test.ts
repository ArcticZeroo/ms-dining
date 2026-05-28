import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    ACCOMPANIMENT_FILTER,
    DRINK_FILTER,
    NON_ENTREE_FILTER,
} from '../../shared/util/menu-item-filter.js';

const makeItem = (overrides: { name?: string; description?: string | null; searchTags?: string[] } = {}) => ({
    name: overrides.name ?? 'Test Item',
    description: overrides.description,
    searchTags: new Set(overrides.searchTags ?? []),
});

describe('DRINK_FILTER', () => {
    describe('matchesSearchTags', () => {
        it('matches the canonical "beverage" tag', () => {
            assert.ok(DRINK_FILTER.matchesSearchTags(new Set(['beverage'])));
        });

        it('matches singular and plural drink tags', () => {
            assert.ok(DRINK_FILTER.matchesSearchTags(new Set(['drink'])));
            assert.ok(DRINK_FILTER.matchesSearchTags(new Set(['drinks'])));
            assert.ok(DRINK_FILTER.matchesSearchTags(new Set(['beverages'])));
        });

        it('matches specific drink-type tags (coffee/tea/etc)', () => {
            for (const tag of ['coffee', 'espresso', 'latte', 'mocha', 'cappuccino', 'americano', 'tea', 'chai', 'smoothie', 'boba', 'cocktail', 'soda', 'juice']) {
                assert.ok(DRINK_FILTER.matchesSearchTags(new Set([tag])), `expected to match tag "${tag}"`);
            }
        });

        it('does not match unrelated food tags', () => {
            for (const tag of ['sandwich', 'burger', 'salad', 'pasta', 'pizza', 'vegetarian']) {
                assert.equal(DRINK_FILTER.matchesSearchTags(new Set([tag])), false, `expected NOT to match tag "${tag}"`);
            }
        });

        it('matches when at least one of several tags matches', () => {
            assert.ok(DRINK_FILTER.matchesSearchTags(new Set(['vegetarian', 'beverage', 'cold'])));
        });
    });

    describe('matchesStationOrCategory', () => {
        it('matches drink-named stations at word boundaries', () => {
            assert.ok(DRINK_FILTER.matchesStationOrCategory('Coffee'));
            assert.ok(DRINK_FILTER.matchesStationOrCategory('Espresso Bar'));
            assert.ok(DRINK_FILTER.matchesStationOrCategory('Beverages'));
            assert.ok(DRINK_FILTER.matchesStationOrCategory('Cold Brew'));
        });

        it('does not match stations whose names only contain a drink term as a substring', () => {
            // "Steak" contains "tea" — must not trigger because of \b boundary
            assert.equal(DRINK_FILTER.matchesStationOrCategory('Steakhouse'), false);
        });

        it('does not match non-drink stations', () => {
            assert.equal(DRINK_FILTER.matchesStationOrCategory('Grill'), false);
            assert.equal(DRINK_FILTER.matchesStationOrCategory('Salad Bar'), false);
        });
    });
});

describe('NON_ENTREE_FILTER includes DRINK_FILTER terms', () => {
    it('matches every drink tag that DRINK_FILTER matches', () => {
        for (const tag of ['beverage', 'coffee', 'espresso', 'latte', 'tea', 'chai', 'smoothie', 'soda', 'juice']) {
            assert.ok(NON_ENTREE_FILTER.matchesSearchTags(new Set([tag])), `NON_ENTREE_FILTER should subsume DRINK_FILTER tag "${tag}"`);
        }
    });

    it('still matches non-drink, non-accompaniment categories (desserts, snacks)', () => {
        assert.ok(NON_ENTREE_FILTER.matchesStationOrCategory('Dessert'));
        assert.ok(NON_ENTREE_FILTER.matchesStationOrCategory('Snacks'));
    });

    it('still matches accompaniment categories', () => {
        assert.ok(NON_ENTREE_FILTER.matchesStationOrCategory('Side'));
        assert.ok(NON_ENTREE_FILTER.matchesStationOrCategory('Sauces'));
    });
});

describe('ACCOMPANIMENT_FILTER (regression)', () => {
    it('matches sides via search tag', () => {
        assert.ok(ACCOMPANIMENT_FILTER.matchesMenuItem(makeItem({ searchTags: ['side'] })));
    });

    it('matches plural "sides" tag (auto-expanded)', () => {
        assert.ok(ACCOMPANIMENT_FILTER.matchesMenuItem(makeItem({ searchTags: ['sides'] })));
    });

    it('does not match drinks', () => {
        assert.equal(ACCOMPANIMENT_FILTER.matchesMenuItem(makeItem({ searchTags: ['beverage'] })), false);
    });
});

describe('MenuItemFilter plural handling', () => {
    it('matches both singular and plural tag forms when only singular is listed', () => {
        // DRINK_FILTER_TERMS lists "drink" only; "drinks" should also match via auto-plural.
        assert.ok(DRINK_FILTER.matchesSearchTags(new Set(['drink'])));
        assert.ok(DRINK_FILTER.matchesSearchTags(new Set(['drinks'])));
        assert.ok(DRINK_FILTER.matchesSearchTags(new Set(['beverage'])));
        assert.ok(DRINK_FILTER.matchesSearchTags(new Set(['beverages'])));
    });

    it('does not double-pluralize terms already ending in s', () => {
        // "starbucks" ends in 's' so we should not auto-add "starbuckss".
        // We can only observe this indirectly: matchesSearchTags on "starbuckss" must be false.
        assert.equal(DRINK_FILTER.matchesSearchTags(new Set(['starbuckss'])), false);
    });
});
