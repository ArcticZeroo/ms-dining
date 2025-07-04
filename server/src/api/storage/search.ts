import { IMenuItem } from '@msdining/common/dist/models/cafe.js';
import {
    DB_ID_TO_SEARCH_ENTITY_TYPE,
    ISearchQuery,
    SearchEntityType,
    SearchMatchReason
} from '@msdining/common/dist/models/search.js';
import { fuzzySearch, normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { ICheapItemSearchResult, IServerSearchResult } from '../../models/search.js';
import { Nullable } from '../../models/util.js';
import { getStationLogoUrl, getThumbnailUrl, getLogoUrl } from '../../util/cafe.js';
import { DailyMenuStorageClient } from './clients/daily-menu.js';
import { MenuItemStorageClient } from './clients/menu-item.js';
import * as vectorClient from './vector/client.js';
import { IVectorSearchResult } from '../../models/vector.js';
import { StationStorageClient } from './clients/station.js';
import { CafeStorageClient } from './clients/cafe.js';
import { logDebug } from '../../util/log.js';
import { ALL_CAFES, CAFE_GROUP_LIST, CAFES_BY_ID } from '../../constants/cafes.js';

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

interface IAddResultParamsBase {
    type: SearchEntityType;
    matchReasons: Iterable<SearchMatchReason>;
    name: string;
    station: Nullable<string>;
    price: Nullable<number>;
    description: Nullable<string>;
    imageUrl: Nullable<string>;
    tags: Nullable<Set<string>>;
    searchTags: Nullable<Set<string>>;
    matchedModifiers?: Map<string, Set<string>>;
    vectorDistance?: number;
}

interface IAddResultParamsWithoutAppearance extends IAddResultParamsBase {
    dateString: undefined;
    cafeId: undefined;
}

interface IAddResultParamsWithAppearance extends IAddResultParamsBase {
    dateString: string;
    cafeId: string;
}

interface IAddResultParamsForCafe extends IAddResultParamsBase {
    type: SearchEntityType.cafe;
    dateString: undefined;
    cafeId: string;
}

type IAddResultParams = IAddResultParamsWithoutAppearance | IAddResultParamsWithAppearance | IAddResultParamsForCafe;

interface ISimilarEntitySearchParams {
    entityType: SearchEntityType;
    entityName: string;
    date: Date;
}

class SearchResults {
    readonly searchResultsByNameByEntityType = new Map<SearchEntityType, Map<string, IServerSearchResult>>();

    #ensureEntityTypeExists(entityType: SearchEntityType) {
        if (!this.searchResultsByNameByEntityType.has(entityType)) {
            this.searchResultsByNameByEntityType.set(entityType, new Map<string, IServerSearchResult>());
        }
    }

    #getResultsForType(entityType: SearchEntityType) {
        this.#ensureEntityTypeExists(entityType);
        return this.searchResultsByNameByEntityType.get(entityType)!;
    }

    set(entityType: SearchEntityType, name: string, result: IServerSearchResult) {
        this.#ensureEntityTypeExists(entityType);
        const searchResultsById = this.searchResultsByNameByEntityType.get(entityType)!;
        searchResultsById.set(name, result);
    }

    delete(entityType: SearchEntityType, name: string) {
        const searchResultsById = this.#getResultsForType(entityType);
        searchResultsById.delete(name);
    }

    get(entityType: SearchEntityType, name: string) {
        const searchResultsById = this.#getResultsForType(entityType);
        return searchResultsById.get(name);
    }

    has(entityType: SearchEntityType, name: string) {
        const searchResultsById = this.#getResultsForType(entityType);
        return searchResultsById.has(name);
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
                  matchedModifiers,
                  vectorDistance
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
                vectorDistance,
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

        if (vectorDistance != null) {
            if (searchResult.vectorDistance == null || searchResult.vectorDistance > vectorDistance) {
                searchResult.vectorDistance = vectorDistance;
            }
        }

        for (const matchReason of matchReasons) {
            searchResult.matchReasons.add(matchReason);
        }

        if (cafeId != null) {
            if (type === SearchEntityType.cafe) {
                searchResult.cafeId = cafeId;
            } else {
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
            }
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

class SearchSession {
    readonly queries: Array<ISearchQuery>;
    readonly shouldUseExactMatch: boolean;
    readonly date: Date | null;

    readonly #searchResults = new SearchResults();
    readonly #pendingSearchResults = new SearchResults();
    readonly #normalizedQueries: Array<ISearchQuery>;
    #hasAnyNonEmptyQuery: boolean = false;

    constructor({ queries, shouldUseExactMatch, date }: IMultiQuerySearchParams) {
        this.queries = queries;
        this.shouldUseExactMatch = shouldUseExactMatch;
        this.date = date;

        this.#normalizedQueries = queries.map(({ text, type }) => {
            const normalizedText = normalizeNameForSearch(text);

            if (normalizedText.length > 0) {
                this.#hasAnyNonEmptyQuery = true;
            }

            return {
                text: normalizedText,
                type
            };
        });
    }

    get results() {
        return this.#searchResults.searchResultsByNameByEntityType;
    }

    getMenusAsync() {
        return DailyMenuStorageClient.getMenusForSearch(this.date);
    }

    isMatch(text: Nullable<string>, entityType: SearchEntityType) {
        if (!text || !this.#hasAnyNonEmptyQuery) {
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

    isExactSubstring(text: Nullable<string>, entityType: SearchEntityType) {
        if (!text || !this.#hasAnyNonEmptyQuery) {
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

            return normalizedText.includes(query.text);
        });
    }

    isVectorMatch(distance: number | undefined, entityType: SearchEntityType, exactMatchCandidates: Array<Nullable<string>>) {
        if (distance != null) {
            return true;
        }

        return exactMatchCandidates.some(candidate => candidate && this.isExactSubstring(candidate, entityType));
    }

    #addPendingResult(result: IAddResultParams) {
        if (this.#searchResults.has(result.type, result.name)) {
            this.#searchResults.addResult(result);
        } else {
            this.#pendingSearchResults.addResult(result);
        }
    }

    #addResult(result: IAddResultParams) {
        const pendingResult = this.#pendingSearchResults.get(result.type, result.name);
        if (pendingResult) {
            this.#searchResults.set(result.type, result.name, pendingResult);
            this.#pendingSearchResults.delete(result.type, result.name);
        }

        this.#searchResults.addResult(result);
    }

    registerResult(isMatch: boolean, result: IAddResultParams) {
        if (isMatch) {
            this.#addResult(result);
        } else {
            this.#addPendingResult(result);
        }
    }

    getMenuItemMatch(menuItem: IMenuItem) {
        const matchReasons = new Set<SearchMatchReason>();
        const matchedModifiers = new Map<string, Set<string>>();

        if (this.isMatch(menuItem.name, SearchEntityType.menuItem)) {
            matchReasons.add(SearchMatchReason.title);
        }

        // If we are using exact name matching, we don't want to get anything that just matches the tags
        // or description. Exact match is intended to be used for favorites, where you don't care about
        // similar items.
        if (!this.shouldUseExactMatch) {
            if (this.isMatch(menuItem.description, SearchEntityType.menuItem)) {
                matchReasons.add(SearchMatchReason.description);
            }

            for (const searchTag of menuItem.searchTags) {
                if (this.isMatch(searchTag, SearchEntityType.menuItem)) {
                    matchReasons.add(SearchMatchReason.searchTags);
                    break;
                }
            }

            for (const modifier of menuItem.modifiers) {
                if (this.isMatch(modifier.description, SearchEntityType.menuItem)) {
                    matchReasons.add(SearchMatchReason.modifier);
                    matchedModifiers.set(modifier.description, new Set<string>());
                }

                for (const modifierChoice of modifier.choices) {
                    if (this.isMatch(modifierChoice.description, SearchEntityType.menuItem)) {
                        matchReasons.add(SearchMatchReason.modifier);

                        const matchedChoices = matchedModifiers.get(modifierChoice.description) ?? new Set<string>();
                        matchedChoices.add(modifierChoice.description);
                        matchedModifiers.set(modifier.description, matchedChoices);
                    }
                }
            }
        }

        for (const tag of menuItem.tags) {
            if (this.isMatch(tag, SearchEntityType.menuItem)) {
                matchReasons.add(SearchMatchReason.tags);
                break;
            }
        }

        return { matchReasons, matchedModifiers } as const;
    }

    getStationMatch(name: string) {
        const matchReasons = new Set<SearchMatchReason>();
        if (this.isMatch(name, SearchEntityType.station)) {
            matchReasons.add(SearchMatchReason.title);
        }

        return { matchReasons } as const;
    }

    getCafeMatch(cafe: { name: string; shortName?: string | number; emoji?: string }, groupName?: string) {
        const matchReasons = new Set<SearchMatchReason>();
        
        // Check cafe name
        if (this.isMatch(cafe.name, SearchEntityType.cafe)) {
            matchReasons.add(SearchMatchReason.title);
        }
        
        // Check short name if it exists
        if (cafe.shortName && this.isMatch(String(cafe.shortName), SearchEntityType.cafe)) {
            matchReasons.add(SearchMatchReason.title);
        }
        
        // Check group name if provided
        if (groupName && this.isMatch(groupName, SearchEntityType.cafe)) {
            matchReasons.add(SearchMatchReason.description);
        }
        
        return { matchReasons } as const;
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

            const { matchReasons: stationMatchReasons } = session.getStationMatch(stationData.name);
            session.registerResult(stationMatchReasons.size > 0, {
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

            for (const category of dailyStation.categories) {
                for (const dailyMenuItem of category.menuItems) {
                    const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(dailyMenuItem.menuItemId);

                    if (menuItem == null) {
                        continue;
                    }

                    const { matchReasons, matchedModifiers } = session.getMenuItemMatch(menuItem);
                    session.registerResult(matchReasons.size > 0, {
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

        return session.results;
    }

    public static async search(query: string, date: Date | null, shouldUseExactMatch: boolean = false): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> {
        return SearchManager._performMultiQuerySearch({
            queries: [{ text: query }],
            date,
            shouldUseExactMatch
        });
    }

    private static async _searchVectorInner(query: string, date: Date | null, doVectorSearch: () => Promise<IVectorSearchResult[]>, allowResultsWithoutAppearances: boolean): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> {
        const session = new SearchSession({
            queries:             [{ text: query }],
            shouldUseExactMatch: false,
            date,
        });

        const [rawResults, menus] = await Promise.all([
            doVectorSearch(),
            session.getMenusAsync()
        ]);

        const vectorFoundItemsWithoutAppearances = new Map<SearchEntityType, Set<string /*id*/>>();
        const vectorFoundItems = new Map<SearchEntityType, Map<string /*id*/, number /*distance*/>>();
        for (const result of rawResults) {
            const entityType = DB_ID_TO_SEARCH_ENTITY_TYPE[result.entity_type] as SearchEntityType;
            if (!entityType) {
                throw new Error(`Invalid entity type: ${result.entity_type}`);
            }

            if (!vectorFoundItems.has(entityType)) {
                vectorFoundItems.set(entityType, new Map());
            }

            if (!vectorFoundItemsWithoutAppearances.has(entityType)) {
                vectorFoundItemsWithoutAppearances.set(entityType, new Set());
            }

            vectorFoundItems.get(entityType)!.set(result.id, result.distance);
            vectorFoundItemsWithoutAppearances.get(entityType)!.add(result.id);
        }

        const getVectorDistanceAndMarkSeen = (entityType: SearchEntityType, id: string) => {
            if (!vectorFoundItems.has(entityType)) {
                return undefined;
            }

            vectorFoundItemsWithoutAppearances.get(entityType)?.delete(id);
            return vectorFoundItems.get(entityType)?.get(id);
        };

        for (const { dateString, cafeId, station, stationId, categories } of menus) {
            const stationDistance = getVectorDistanceAndMarkSeen(SearchEntityType.station, stationId);
            const { matchReasons: stationMatchReasons } = session.getStationMatch(station.name);

            session.registerResult(
                session.isVectorMatch(stationDistance, SearchEntityType.station, [station.name]),
                {
                    type:           SearchEntityType.station,
                    matchReasons:   stationMatchReasons,
                    dateString:     dateString,
                    cafeId:         cafeId,
                    name:           station.name,
                    imageUrl:       getStationLogoUrl(station.name, station.logoUrl),
                    vectorDistance: stationDistance,
                    // No data for stations
                    price:       undefined,
                    searchTags:  undefined,
                    tags:        undefined,
                    description: undefined,
                    station:     undefined
                });

            for (const category of categories) {
                for (const dailyMenuItem of category.menuItems) {
                    const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(dailyMenuItem.menuItemId);
                    if (menuItem == null) {
                        continue;
                    }

                    const menuItemDistance = getVectorDistanceAndMarkSeen(SearchEntityType.menuItem, menuItem.id);

                    const { matchReasons, matchedModifiers } = session.getMenuItemMatch(menuItem);

                    const exactMatchCandidates: Array<Nullable<string>> = [
                        menuItem.name,
                        menuItem.description,
                        ...menuItem.searchTags,
                        ...menuItem.tags,
                        ...menuItem.modifiers.flatMap(modifier => [modifier.description, ...modifier.choices.map(choice => choice.description)])
                    ];

                    session.registerResult(
                        session.isVectorMatch(menuItemDistance, SearchEntityType.menuItem, exactMatchCandidates),
                        {
                            type:             SearchEntityType.menuItem,
                            dateString:       dateString,
                            cafeId:           cafeId,
                            name:             menuItem.name,
                            description:      menuItem.description,
                            price:            menuItem.price,
                            tags:             menuItem.tags,
                            searchTags:       menuItem.searchTags,
                            imageUrl:         getThumbnailUrl(menuItem),
                            station:          station.name,
                            matchReasons:     matchReasons,
                            matchedModifiers: matchedModifiers,
                            vectorDistance:   menuItemDistance,
                        });
                }
            }
        }

        if (allowResultsWithoutAppearances) {
            for (const [entityType, ids] of vectorFoundItemsWithoutAppearances) {
                for (const id of ids) {
                    if (entityType === SearchEntityType.station) {
                        const station = await StationStorageClient.retrieveStationAsync(id);
                        if (station != null) {
                            logDebug('Adding vector station result without appearance', station.name);
                            const { matchReasons: stationMatchReasons } = session.getStationMatch(station.name);
                            session.registerResult(true /*isMatch*/, {
                                type:         SearchEntityType.station,
                                matchReasons: stationMatchReasons,
                                dateString:   undefined,
                                cafeId:       undefined,
                                name:         station.name,
                                imageUrl:     getStationLogoUrl(station.name, station.logoUrl),
                                // No data for stations
                                price:       undefined,
                                searchTags:  undefined,
                                tags:        undefined,
                                description: undefined,
                                station:     undefined
                            });
                        } else {
                            logDebug('Station not found for vector result', id);
                        }
                    } else if (entityType === SearchEntityType.menuItem) {
                        // todo: find the last appearance maybe? would be nice to have cafe/station data.
                        const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(id);
                        if (menuItem != null) {
                            logDebug('Adding vector menu item result without appearance', menuItem.name);
                            const { matchReasons, matchedModifiers } = session.getMenuItemMatch(menuItem);
                            session.registerResult(true /*isMatch*/, {
                                type:        SearchEntityType.menuItem,
                                dateString:  undefined,
                                cafeId:      undefined,
                                name:        menuItem.name,
                                description: menuItem.description,
                                price:       menuItem.price,
                                tags:        menuItem.tags,
                                searchTags:  menuItem.searchTags,
                                imageUrl:    getThumbnailUrl(menuItem),
                                station:     undefined,
                                matchReasons,
                                matchedModifiers
                            });
                        }
                    } else if (entityType === SearchEntityType.cafe) {
                        // Find the cafe by ID
                        const cafe = CAFES_BY_ID.get(id);
                        if (cafe != null) {
                            logDebug('Adding vector cafe result without appearance', cafe.name);

                            // Find the group this cafe belongs to
                            const group = CAFE_GROUP_LIST.find(g => g.members.some(member => member.id === cafe.id));
                            const { matchReasons } = session.getCafeMatch(cafe, group?.name);
                            
                            // Get cafe config for logo
                            const cafeConfig = await CafeStorageClient.retrieveCafeAsync(cafe.id);

                            if (!cafeConfig) {
                                logDebug('Cafe config not found for vector result', cafe.id);
                                continue;
                            }

                            session.registerResult(true /*isMatch*/, {
                                type:         SearchEntityType.cafe,
                                dateString:   undefined,
                                cafeId:       cafe.id,
                                name:         cafe.name,
                                description:  undefined,
                                imageUrl:     getLogoUrl(cafe, cafeConfig),
                                // No pricing/station data for cafes
                                price:        undefined,
                                searchTags:   undefined,
                                tags:         undefined,
                                station:      undefined,
                                matchReasons,
                                matchedModifiers: new Map()
                            });
                        } else {
                            logDebug('Cafe not found for vector result', id);
                        }
                    }
                }
            }
        }

        return session.results;
    }

    public static async searchVector(query: string, date: Date | null, allowResultsWithoutAppearances: boolean): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> {
        return SearchManager._searchVectorInner(query, date, () => vectorClient.searchVectorRawFromQuery(query), allowResultsWithoutAppearances);
    }

    public static async searchForSimilarEntities({ entityName, entityType, date }: ISimilarEntitySearchParams): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> {
        // todo: find ids for all entities with the same name, then get embeddings for each entity
        return new Map();
        // return SearchManager._searchVectorInner('', date, () => vectorClient.searchSimilarEntities(entityType, entityName), false /*allowResultsWithoutAppearances*/);
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
                    const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(dailyMenuItem.menuItemId);

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