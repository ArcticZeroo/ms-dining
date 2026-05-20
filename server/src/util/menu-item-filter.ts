/**
 * Shared utility for filtering menu items by category type (accompaniments, beverages, etc.).
 * Used by both the recommendation system and the cheap items search to exclude
 * items that aren't meaningful standalone recommendations or entrees.
 */
import { Nullable } from '../shared/models/util.js';

// Accompaniment items: sides, condiments, sauces, dressings
const ACCOMPANIMENT_FILTER_TERMS = [
    'side',
    'condiment',
    'sauce',
    'dressing',
];

// Drink/beverage items. Includes both AI-generated search-tag strings
// (e.g. "beverage", "hotdrink") and human-readable name/category words
// (e.g. "cold brew", "starbucks") so a single filter covers both pathways.
// Plurals are handled automatically by MenuItemFilter; list singulars only.
const DRINK_FILTER_TERMS = [
    'beverage',
    'drink',
    'coffee',
    'espresso',
    'latte',
    'mocha',
    'cappuccino',
    'americano',
    'macchiato',
    'tea',
    'chai',
    'matcha',
    'smoothie',
    'milkshake',
    'shake',
    'boba',
    'bubbletea',
    'cocktail',
    'mocktail',
    'soda',
    'juice',
    'hotdrink',
    'colddrink',
    'softdrink',
    'sparkling',
    'cold brew',
    'french press',
    'starbucks',
];

// Non-entree items: accompaniments + drinks + desserts, snacks, etc.
// Used by cheap items search to focus on actual entrees.
const NON_ENTREE_FILTER_TERMS = [
    ...ACCOMPANIMENT_FILTER_TERMS,
    ...DRINK_FILTER_TERMS,
    'dessert',
    'snack',
    'sweet',
    'sweet street',
    'bakery',
];

export class MenuItemFilter {
    private readonly wordBoundaryRegex: RegExp;
    private readonly substringRegex: RegExp;
    private readonly termSet: Set<string>;

    constructor(terms: readonly string[]) {
        const pattern = `(${terms.join('|')})s?`;
        this.wordBoundaryRegex = new RegExp(`\\b${pattern}\\b`, 'i');
        this.substringRegex = new RegExp(pattern, 'i');
        // Mirror the regex's trailing-s tolerance for exact tag matches:
        // include both the bare and +s form so a tag like "sides" matches "side".
        this.termSet = new Set<string>();
        for (const term of terms) {
            const lower = term.toLowerCase();
            this.termSet.add(lower);
            if (!lower.endsWith('s')) {
                this.termSet.add(`${lower}s`);
            }
        }
    }

    /**
	 * Checks if a station or category name matches any filter term (word boundary match).
	 * Used for broad filtering at the station/category level.
	 */
    matchesStationOrCategory(name: string): boolean {
        return this.wordBoundaryRegex.test(name);
    }

    /**
	 * Checks if an item name or description contains any filter term (substring match).
	 * Looser than word boundary — catches things like "Sidedish" or compound words.
	 */
    matchesItemText(text: string): boolean {
        return this.substringRegex.test(text);
    }

    /**
	 * Checks if any of the item's search tags match a filter term.
	 * Search tags are AI-generated lowercase strings like "side", "condiment", "vegetables".
	 */
    matchesSearchTags(tags: Set<string>): boolean {
        for (const tag of tags) {
            if (this.termSet.has(tag)) {
                return true;
            }
        }
        return false;
    }

	matchesMenuItem(menuItem: { name: string; description?: Nullable<string>; searchTags: Set<string> }): boolean {
		return this.matchesItemText(menuItem.name)
			|| (menuItem.description && this.matchesItemText(menuItem.description))
			|| this.matchesSearchTags(menuItem.searchTags);
	}
}

export const ACCOMPANIMENT_FILTER = new MenuItemFilter(ACCOMPANIMENT_FILTER_TERMS);
export const DRINK_FILTER = new MenuItemFilter(DRINK_FILTER_TERMS);
export const NON_ENTREE_FILTER = new MenuItemFilter(NON_ENTREE_FILTER_TERMS);
