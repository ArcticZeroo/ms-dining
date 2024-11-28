import { ISearchQuery, SearchEntityType, SearchMatchReason } from '@msdining/common/dist/models/search.js';
import { fuzzySearch, normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { ICheapItemSearchResult, IServerSearchResult } from '../../models/search.js';
import { Nullable } from '../../models/util.js';
import { getThumbnailUrl } from '../../util/cafe.js';
import { DailyMenuStorageClient } from './clients/daily-menu.js';
import { MenuItemStorageClient } from './clients/menu-item.js';

// Items that are indeed cheap, but are not food/entree options
const CHEAP_ITEM_IGNORE_TERMS = [
    'side',
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
    'bakery'
];

const CHEAP_ITEM_IGNORE_STRING = `(${CHEAP_ITEM_IGNORE_TERMS.join('|')})s?`;
const CHEAP_ITEM_WORDS_REGEX = new RegExp(`\\b${CHEAP_ITEM_IGNORE_STRING}\\b`, 'i');
const CHEAP_ITEM_SUBSTRING_REGEX = new RegExp(`${CHEAP_ITEM_IGNORE_STRING}`, 'i');

interface IMultiQuerySearchParams {
    queries: Array<ISearchQuery>;
    shouldUseExactMatch: boolean;
    date: Date | null;
}

interface ICheapItemSearchParams {
    minPrice: number;
    maxPrice: number;
    date: Date | null;
}

interface IAddResultParams {
    type: SearchEntityType;
    dateString: string;
    cafeId: string;
    matchReasons: Iterable<SearchMatchReason>;
    name: string;
    station: Nullable<string>;
    price: Nullable<number>;
    description: Nullable<string>;
    imageUrl: Nullable<string>;
    tags: Nullable<Set<string>>;
    searchTags: Nullable<Set<string>>;
    matchedModifiers?: Map<string, Set<string>>;
}


class SearchSession {
    readonly queries: Array<ISearchQuery>;
    readonly shouldUseExactMatch: boolean;
    readonly date: Date | null;
    readonly searchResultsByNameByEntityType = new Map<SearchEntityType, Map<string, IServerSearchResult>>();

    readonly #normalizedQueries: Array<ISearchQuery>;

    constructor({ queries, shouldUseExactMatch, date }: IMultiQuerySearchParams) {
        this.queries = queries;
        this.shouldUseExactMatch = shouldUseExactMatch;
        this.date = date;

        this.#normalizedQueries = queries.map(({ text, type }) => {
            return {
                text: normalizeNameForSearch(text),
                type
            } as const;
        });
    }

    #ensureEntityTypeExists(entityType: SearchEntityType) {
        if (!this.searchResultsByNameByEntityType.has(entityType)) {
            this.searchResultsByNameByEntityType.set(entityType, new Map<string, IServerSearchResult>());
        }
    }

    #getResultsForType(entityType: SearchEntityType) {
        this.#ensureEntityTypeExists(entityType);
        return this.searchResultsByNameByEntityType.get(entityType)!;
    }

    isResultAlreadyAdded(entityType: SearchEntityType, name: string) {
        return this.#getResultsForType(entityType).has(normalizeNameForSearch(name));
    }

    getMenusAsync() {
        return DailyMenuStorageClient.getMenusForSearch(this.date);
    }

    isMatch(text: Nullable<string>, entityType: SearchEntityType) {
        if (!text) {
            return false;
        }

        const normalizedText = normalizeNameForSearch(text);
        if (normalizedText.length === 0) {
            return false;
        }

        return this.#normalizedQueries.some(query => {
            if (query.type != null && query.type !== entityType) {
                return false;
            }

            if (this.shouldUseExactMatch) {
                return normalizedText === query.text;
            } else {
                return fuzzySearch(normalizedText, query.text);
            }
        });
    }

    addResult({
                  type,
                  name,
                  description,
                  imageUrl,
                  dateString,
                  cafeId,
                  matchReasons,
                  station,
                  price,
                  tags,
                  searchTags,
                  matchedModifiers
              }: IAddResultParams) {
        this.#ensureEntityTypeExists(type);

        const searchResultsById = this.searchResultsByNameByEntityType.get(type)!;
        const normalizedName = normalizeNameForSearch(name);

        if (!searchResultsById.has(normalizedName)) {
            searchResultsById.set(normalizedName, {
                type,
                name,
                description,
                imageUrl,
                tags:                  tags || undefined,
                searchTags:            searchTags || undefined,
                locationDatesByCafeId: new Map<string, Set<string>>(),
                priceByCafeId:         new Map<string, number>(),
                stationByCafeId:       new Map<string, string>(),
                matchReasons:          new Set<SearchMatchReason>(),
                matchedModifiers:      new Map<string, Set<string>>()
            });
        }

        const searchResult = searchResultsById.get(normalizedName)!;

        for (const matchReason of matchReasons) {
            searchResult.matchReasons.add(matchReason);
        }

        if (!searchResult.locationDatesByCafeId.has(cafeId)) {
            searchResult.locationDatesByCafeId.set(cafeId, new Set());
        }
        searchResult.locationDatesByCafeId.get(cafeId)!.add(dateString);

        if (price != null) {
            searchResult.priceByCafeId.set(cafeId, price);
        }

        if (station != null) {
            searchResult.stationByCafeId.set(cafeId, station);
        }

        if (searchTags) {
            const combinedSearchTags = searchResult.searchTags || new Set<string>();
            for (const tag of searchTags) {
                combinedSearchTags.add(tag);
            }

            searchResult.searchTags = combinedSearchTags;
        }

        if (tags) {
            const combinedTags = searchResult.tags || new Set<string>();
            for (const tag of tags) {
                combinedTags.add(tag);
            }

            searchResult.tags = combinedTags;
        }

        if (matchedModifiers) {
            for (const [modifierDescription, choiceDescriptions] of matchedModifiers) {
                const combinedChoiceDescriptions = searchResult.matchedModifiers.get(modifierDescription) ?? new Set<string>();
                for (const choiceDescription of choiceDescriptions) {
                    combinedChoiceDescriptions.add(choiceDescription);
                }
                searchResult.matchedModifiers.set(modifierDescription, combinedChoiceDescriptions);
            }
        }

        // The first item to make it into the map might not be the one with all the info.
        searchResult.description = searchResult.description || description;
        searchResult.imageUrl = searchResult.imageUrl || imageUrl;
    }
}

// This is not a storage client because it orchestrates multiple storage clients together,
// which otherwise should not be interacting (to avoid circular dependencies).
export abstract class SearchManager {
    private static async _performMultiQuerySearch({
                                                      queries,
                                                      shouldUseExactMatch,
                                                      date
                                                  }: IMultiQuerySearchParams): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> {
        const session = new SearchSession({ queries, shouldUseExactMatch, date });
        const dailyStations = await session.getMenusAsync();

        for (const dailyStation of dailyStations) {
            const stationData = dailyStation.station;

            const stationMatchReasons = new Set<SearchMatchReason>();
            if (session.isMatch(stationData.name, SearchEntityType.station)) {
                stationMatchReasons.add(SearchMatchReason.title);
            }

            if (stationMatchReasons.size > 0 || session.isResultAlreadyAdded(SearchEntityType.station, stationData.name)) {
                session.addResult({
                    type:         SearchEntityType.station,
                    matchReasons: stationMatchReasons,
                    dateString:   dailyStation.dateString,
                    cafeId:       dailyStation.cafeId,
                    name:         stationData.name,
                    imageUrl:     stationData.logoUrl,
                    // No data for stations
                    price:       undefined,
                    searchTags:  undefined,
                    tags:        undefined,
                    description: undefined,
                    station:     undefined
                });
            }

            for (const category of dailyStation.categories) {
                for (const dailyMenuItem of category.menuItems) {
                    const menuItem = await MenuItemStorageClient.retrieveMenuItemLocallyAsync(dailyMenuItem.menuItemId);

                    if (menuItem == null) {
                        continue;
                    }

                    const matchReasons = new Set<SearchMatchReason>();
                    const matchedModifiers = new Map<string, Set<string>>();

                    if (session.isMatch(menuItem.name, SearchEntityType.menuItem)) {
                        matchReasons.add(SearchMatchReason.title);
                    }

                    // If we are using exact name matching, we don't want to get anything that just matches the tags
                    // or description. Exact match is intended to be used for favorites, where you don't care about
                    // similar items.
                    if (!shouldUseExactMatch) {
                        if (session.isMatch(menuItem.description, SearchEntityType.menuItem)) {
                            matchReasons.add(SearchMatchReason.description);
                        }

                        for (const searchTag of menuItem.searchTags) {
                            if (session.isMatch(searchTag, SearchEntityType.menuItem)) {
                                matchReasons.add(SearchMatchReason.searchTags);
                                break;
                            }
                        }

                        for (const modifier of menuItem.modifiers) {
                            if (session.isMatch(modifier.description, SearchEntityType.menuItem)) {
                                matchReasons.add(SearchMatchReason.modifier);
                                matchedModifiers.set(modifier.description, new Set<string>());
                            }

                            for (const modifierChoice of modifier.choices) {
                                if (session.isMatch(modifierChoice.description, SearchEntityType.menuItem)) {
                                    matchReasons.add(SearchMatchReason.modifier);

                                    const matchedChoices = matchedModifiers.get(modifierChoice.description) ?? new Set<string>();
                                    matchedChoices.add(modifierChoice.description);
                                    matchedModifiers.set(modifier.description, matchedChoices);
                                }
                            }
                        }
                    }

                    for (const tag of menuItem.tags) {
                        if (session.isMatch(tag, SearchEntityType.menuItem)) {
                            matchReasons.add(SearchMatchReason.tags);
                            break;
                        }
                    }

                    if (matchReasons.size > 0 || session.isResultAlreadyAdded(SearchEntityType.menuItem, menuItem.name)) {
                        session.addResult({
                            type:        SearchEntityType.menuItem,
                            dateString:  dailyStation.dateString,
                            cafeId:      dailyStation.cafeId,
                            name:        menuItem.name,
                            description: menuItem.description,
                            price:       menuItem.price,
                            tags:        menuItem.tags,
                            searchTags:  menuItem.searchTags,
                            imageUrl:    getThumbnailUrl(menuItem),
                            station:     stationData.name,
                            matchReasons,
                            matchedModifiers
                        });
                    }
                }
            }
        }

        return session.searchResultsByNameByEntityType;
    }

    public static async search(query: string, date: Date | null, shouldUseExactMatch: boolean = false): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> {
        return SearchManager._performMultiQuerySearch({
            queries: [{ text: query }],
            date,
            shouldUseExactMatch
        });
    }

    public static async searchFavorites(queries: Array<ISearchQuery>, date: Date | null): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> {
        return SearchManager._performMultiQuerySearch({
            shouldUseExactMatch: true,
            queries,
            date,
        });
    }

    public static async searchForCheapItems({
                                                minPrice,
                                                maxPrice,
                                                date
                                            }: ICheapItemSearchParams): Promise<ICheapItemSearchResult[]> {
        const dailyStations = await DailyMenuStorageClient.getMenusForSearch(date);

        const resultsByItemNameByPrice = new Map<string, Map<number, ICheapItemSearchResult>>();

        for (const dailyStation of dailyStations) {
            if (CHEAP_ITEM_WORDS_REGEX.test(dailyStation.station.name)) {
                continue;
            }

            for (const category of dailyStation.categories) {
                if (CHEAP_ITEM_WORDS_REGEX.test(category.name)) {
                    continue;
                }

                for (const dailyMenuItem of category.menuItems) {
                    const menuItem = await MenuItemStorageClient.retrieveMenuItemLocallyAsync(dailyMenuItem.menuItemId);

                    if (menuItem == null) {
                        continue;
                    }

                    if (menuItem.price < minPrice || menuItem.price > maxPrice) {
                        continue;
                    }

                    // We only sort by calories per dollar, don't bother if there are no calories
                    if (menuItem.calories === 0 && menuItem.maxCalories === 0) {
                        continue;
                    }

                    if (CHEAP_ITEM_SUBSTRING_REGEX.test(menuItem.name)) {
                        continue;
                    }

                    if (menuItem.description && CHEAP_ITEM_SUBSTRING_REGEX.test(menuItem.description)) {
                        continue;
                    }

                    const normalizedName = normalizeNameForSearch(menuItem.name);

                    if (!resultsByItemNameByPrice.has(normalizedName)) {
                        resultsByItemNameByPrice.set(normalizedName, new Map<number, ICheapItemSearchResult>());
                    }

                    const resultsByPrice = resultsByItemNameByPrice.get(normalizedName)!;

                    if (!resultsByPrice.has(menuItem.price)) {
                        resultsByPrice.set(menuItem.price, {
                            name:        menuItem.name,
                            description: menuItem.description,
                            imageUrl:    getThumbnailUrl(menuItem),
                            price:       menuItem.price,
                            // I guess we'll assume that the calories are the same across cafes with the same menu item
                            // price, since those are presumably the same item? Not sure how to deal with this.
                            minCalories:           menuItem.calories,
                            maxCalories:           menuItem.maxCalories === 0
                                                   ? menuItem.calories
                                                   : menuItem.maxCalories,
                            locationDatesByCafeId: new Map<string, Set<string>>()
                        });
                    }

                    const result = resultsByPrice.get(menuItem.price)!;

                    if (!result.locationDatesByCafeId.has(dailyStation.cafeId)) {
                        result.locationDatesByCafeId.set(dailyStation.cafeId, new Set());
                    }

                    result.minCalories = Math.max(result.minCalories, menuItem.calories);
                    result.maxCalories = Math.max(result.maxCalories, menuItem.maxCalories);

                    result.locationDatesByCafeId.get(dailyStation.cafeId)!.add(dailyStation.dateString);
                }
            }
        }

        return Array
            .from(resultsByItemNameByPrice.values())
            .flatMap(resultsByPrice => Array.from(resultsByPrice.values()));
    }
}