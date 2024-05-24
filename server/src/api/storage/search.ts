import { ICheapItemSearchResult, ISearchResult } from '../../models/search.js';
import { ISearchQuery, SearchEntityType, SearchMatchReason } from '@msdining/common/dist/models/search.js';
import { MenuItemStorageClient } from './clients/menu-item.js';
import { getThumbnailUrl } from '../../util/cafe.js';
import { DailyMenuStorageClient } from './clients/daily-menu.js';
import { fuzzySearch, normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { Nullable } from '../../models/util.js';

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

// This is not a storage client because it orchestrates multiple storage clients together,
// which otherwise should not be interacting (to avoid circular dependencies).
export abstract class SearchManager {
    private static async _performMultiQuerySearch(queries: Array<ISearchQuery>, shouldUseExactMatch: boolean): Promise<Map<SearchEntityType, Map<string, ISearchResult>>> {
        const dailyStations = await DailyMenuStorageClient.getAllMenusForWeekForSearch();

        const searchResultsByNameByEntityType = new Map<SearchEntityType, Map<string, ISearchResult>>();

        const ensureEntityTypeExists = (entityType: SearchEntityType) => {
            if (!searchResultsByNameByEntityType.has(entityType)) {
                searchResultsByNameByEntityType.set(entityType, new Map<string, ISearchResult>());
            }
        };

        const isResultAlreadyAdded = (type: SearchEntityType, name: string) => {
            ensureEntityTypeExists(type);
            const searchResultsById = searchResultsByNameByEntityType.get(type)!;
            return searchResultsById.has(normalizeNameForSearch(name));
        }

        interface IAddResultParams {
            type: SearchEntityType;
            dateString: string;
            cafeId: string;
            matchReasons: Iterable<SearchMatchReason>;
            name: string;
            price?: number;
            description?: Nullable<string>;
            imageUrl?: Nullable<string>;
            searchTags?: Set<string>;
        }

        const addResult = ({
                               type,
                               name,
                               description,
                               imageUrl,
                               dateString,
                               cafeId,
                               matchReasons,
                               price,
                               searchTags
                           }: IAddResultParams) => {
            ensureEntityTypeExists(type);

            const searchResultsById = searchResultsByNameByEntityType.get(type)!;
            const normalizedName = normalizeNameForSearch(name);

            if (!searchResultsById.has(normalizedName)) {
                searchResultsById.set(normalizedName, {
                    type,
                    name,
                    description,
                    imageUrl,
                    searchTags,
                    locationDatesByCafeId: new Map<string, Set<string>>(),
                    matchReasons:          new Set<SearchMatchReason>(),
                    prices:                new Set<number>(),
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
                searchResult.prices.add(price);
            }

            if (searchTags) {
                const combinedSearchTags = searchResult.searchTags || new Set<string>();
                for (const tag of searchTags) {
                    combinedSearchTags.add(tag);
                }

                searchResult.searchTags = combinedSearchTags;
            }

            // The first item to make it into the map might not be the one with all the info.
            searchResult.description = searchResult.description || description;
            searchResult.imageUrl = searchResult.imageUrl || imageUrl;
        };

        const normalizedQueries: Array<ISearchQuery> = queries.map(({ text, type }) => {
            return {
                text: normalizeNameForSearch(text),
                type
            } as const;
        });

        const isMatch = (text: Nullable<string>, entityType: SearchEntityType) => {
            if (!text) {
                return false;
            }

            const normalizedText = normalizeNameForSearch(text);
            if (normalizedText.length === 0) {
                return false;
            }

            return normalizedQueries.some(query => {
                if (query.type != null && query.type !== entityType) {
                    return false;
                }

                if (shouldUseExactMatch) {
                    return normalizedText === query.text;
                } else {
                    return fuzzySearch(normalizedText, query.text);
                }
            });
        };

        for (const dailyStation of dailyStations) {
            const stationData = dailyStation.station;

            const stationMatchReasons: SearchMatchReason[] = [];
            if (isMatch(stationData.name, SearchEntityType.station)) {
                stationMatchReasons.push(SearchMatchReason.title);
            }

            if (stationMatchReasons.length > 0 || isResultAlreadyAdded(SearchEntityType.station, stationData.name)) {
                addResult({
                    type:         SearchEntityType.station,
                    matchReasons: stationMatchReasons,
                    dateString:   dailyStation.dateString,
                    cafeId:       dailyStation.cafeId,
                    name:         stationData.name,
                    imageUrl:     stationData.logoUrl,
                });
            }

            for (const category of dailyStation.categories) {
                for (const dailyMenuItem of category.menuItems) {
                    const menuItem = await MenuItemStorageClient.retrieveMenuItemLocallyAsync(dailyMenuItem.menuItemId);

                    if (menuItem == null) {
                        continue;
                    }

                    const matchReasons: SearchMatchReason[] = [];

                    if (isMatch(menuItem.name, SearchEntityType.menuItem)) {
                        matchReasons.push(SearchMatchReason.title);
                    }

                    // If we are using exact name matching, we don't want to get anything that just matches the tags
                    // or description. Exact match is intended to be used for favorites, where you don't care about
                    // similar items.
                    if (!shouldUseExactMatch) {
                        if (isMatch(menuItem.description, SearchEntityType.menuItem)) {
                            matchReasons.push(SearchMatchReason.description);
                        }

                        for (const searchTag of menuItem.searchTags) {
                            if (isMatch(searchTag, SearchEntityType.menuItem)) {
                                matchReasons.push(SearchMatchReason.tags);
                                break;
                            }
                        }
                    }

                    if (matchReasons.length > 0 || isResultAlreadyAdded(SearchEntityType.menuItem, menuItem.name)) {
                        addResult({
                            type:        SearchEntityType.menuItem,
                            dateString:  dailyStation.dateString,
                            cafeId:      dailyStation.cafeId,
                            name:        menuItem.name,
                            description: menuItem.description,
                            price:       menuItem.price,
                            searchTags:  menuItem.searchTags,
                            imageUrl:    getThumbnailUrl(menuItem),
                            matchReasons,
                        });
                    }
                }
            }
        }

        return searchResultsByNameByEntityType;
    }

    public static async search(query: string, shouldUseExactMatch: boolean = false): Promise<Map<SearchEntityType, Map<string, ISearchResult>>> {
        return SearchManager._performMultiQuerySearch([{ text: query }], shouldUseExactMatch);
    }

    public static async searchFavorites(queries: Array<ISearchQuery>): Promise<Map<SearchEntityType, Map<string, ISearchResult>>> {
        return SearchManager._performMultiQuerySearch(queries, true /*shouldUseExactMatch*/);
    }

    public static async searchForCheapItems(minPrice: number, maxPrice: number): Promise<ICheapItemSearchResult[]> {
        const dailyStations = await DailyMenuStorageClient.getAllMenusForWeekForSearch();

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