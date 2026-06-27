export enum SearchEntityType {
    menuItem = 'menuItem',
    station = 'station',
    cafe = 'cafe',
    dailyStation = 'dailyStation',
    building = 'building',
}

export const searchEntityTypeFromString = (rawString: string): SearchEntityType => {
	const result = SearchEntityType[rawString as keyof typeof SearchEntityType];
	if (!result) {
		throw new Error(`Invalid SearchEntityType string: ${rawString}`);
	}
	return result;
}

export const SEARCH_ENTITY_TYPE_NAME_TO_ENUM: { [K in SearchEntityType]: K } = {
    menuItem:     SearchEntityType.menuItem,
    station:      SearchEntityType.station,
    cafe:         SearchEntityType.cafe,
    dailyStation: SearchEntityType.dailyStation,
    building:     SearchEntityType.building,
};

export const SEARCH_ENTITY_TYPE_TO_DB_ID: { [T in SearchEntityType]: number } = {
    [SearchEntityType.menuItem]:     0,
    [SearchEntityType.station]:      1,
    [SearchEntityType.cafe]:         2,
    [SearchEntityType.dailyStation]: 3,
    [SearchEntityType.building]:     4,
};

export const DB_ID_TO_SEARCH_ENTITY_TYPE: { [P in keyof typeof SEARCH_ENTITY_TYPE_TO_DB_ID as typeof SEARCH_ENTITY_TYPE_TO_DB_ID[P]]: P } = {
    0: SearchEntityType.menuItem,
    1: SearchEntityType.station,
    2: SearchEntityType.cafe,
    3: SearchEntityType.dailyStation,
    4: SearchEntityType.building,
};

export enum SearchMatchReason {
    title = 'title',
    description = 'description',
    // AI-generated tags like "breakfast"
    searchTags = 'searchTags',
    // Tags like "vegan"
    tags = 'tags',
    // Modifiers like "Decaf" on a latte
    modifier = 'modifier',
    // Station/cafe promoted because its menu items matched
    childItemMatch = 'childItemMatch'
}

export const allSearchEntityTypes = [
    SearchEntityType.menuItem,
    SearchEntityType.station,
    SearchEntityType.cafe,
];

export enum SearchEntityFilterType {
    all,
    menuItem,
    station,
    cafe
}

export interface ISearchResult {
    entityType: SearchEntityType;
    name: string;
    description?: string;
    imageUrl?: string;
    locationDatesByCafeId: Map<string, Array<Date>>;
    priceByCafeId: Map<string, number>;
    stationByCafeId: Map<string, string>;
    matchReasons: Set<SearchMatchReason>;
    searchTags?: Set<string>;
    tags?: Set<string>;
    matchedModifiers: Map<string, Set<string>>;
    vectorDistance?: number;
}

export interface ISearchQuery {
    text: string;
    type?: SearchEntityType;
}

export interface IAutocompleteSuggestion {
    entityType: SearchEntityType;
    name: string;
    cafeId?: string;
}

export interface IAutocompleteResponse {
    results: IAutocompleteSuggestion[];
}

/** A single date+cafe+station where a menu item appeared in the search window. */
export interface ISearchExplanationAppearance {
    cafeId: string;
    dateString: string;
    stationName: string;
}

/** Diagnostic explanation for why a single menu item did or did not match a query. */
export interface ISearchExplanationItem {
    menuItemId: string;
    name: string;
    cafeId: string;
    stationId: string;
    // ── Embedding signals ──
    /** Whether this item has a stored embedding at all. */
    hasEmbedding: boolean;
    /** Raw cosine distance between the query and this item (0 = identical, 2 = opposite). */
    cosineDistance: number | null;
    /** 1 - cosineDistance, for convenience. */
    cosineSimilarity: number | null;
    /** 1-based rank within the overall vector top-K, or null if it didn't make the cut. */
    vectorRank: number | null;
    /** Whether the item is within the vector top-K (the de-facto cosine cutoff). */
    isInVectorTopK: boolean;
    // ── Text signals ──
    /** Which text fields matched (title/description/tags/searchTags/modifier). */
    nameMatchReasons: SearchMatchReason[];
    /** Whether any field exactly contained the normalized query (vector substring fallback). */
    isExactSubstringMatch: boolean;
    // ── Appearance signals ──
    /** Whether the item appears in the menu for the search window (selected date or current week). */
    appearsInSearchWindow: boolean;
    appearances: ISearchExplanationAppearance[];
    // ── Verdict ──
    /** Result of the same isVectorMatch() the real search uses. */
    isVectorMatch: boolean;
    /** Whether the search loop would register this as a match (vector match or text match). */
    wouldRegisterAsMatch: boolean;
    /** Ground truth: whether this item is actually present in the real search results. */
    isInFinalResults: boolean;
    /** Human-readable explanation of the verdict. */
    reasons: string[];
}

/** A nearest-neighbor menu item for the query, for context. */
export interface ISearchExplanationNearestItem {
    menuItemId: string;
    name: string | null;
    distance: number;
    rank: number;
}

/** Full diagnostic for a query, covering one or more target menu items. */
export interface ISearchExplanation {
    query: string;
    normalizedQuery: string;
    date: string | null;
    allowResultsWithoutAppearances: boolean;
    /** Number of entities returned in the vector top-K (the cutoff window). */
    vectorTopKSize: number;
    /** Cosine distance of the worst entity still included in the top-K. */
    worstIncludedDistance: number | null;
    items: ISearchExplanationItem[];
    nearestMenuItems: ISearchExplanationNearestItem[];
}
