/**
 * Shared utility for filtering menu items by category type (accompaniments, beverages, etc.).
 * Used by both the recommendation system and the cheap items search to exclude
 * items that aren't meaningful standalone recommendations or entrees.
 */

// Accompaniment items: sides, condiments, sauces, dressings
const ACCOMPANIMENT_FILTER_TERMS = [
	'side',
	'condiment',
	'sauce',
	'dressing',
];

// Non-entree items: accompaniments + beverages, desserts, snacks, etc.
// Used by cheap items search to focus on actual entrees.
const NON_ENTREE_FILTER_TERMS = [
	...ACCOMPANIMENT_FILTER_TERMS,
	'coffee',
	'espresso',
	'latte',
	'drink',
	'dessert',
	'snack',
	'tea',
	'sweet',
	'sweet street',
	'starbucks',
	'mocktail',
	'soda',
	'french press',
	'cold brew',
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
		this.termSet = new Set(terms.map(term => term.toLowerCase()));
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
}

export const ACCOMPANIMENT_FILTER = new MenuItemFilter(ACCOMPANIMENT_FILTER_TERMS);
export const NON_ENTREE_FILTER = new MenuItemFilter(NON_ENTREE_FILTER_TERMS);
