import { IMenuItemBase } from '@msdining/common/models/cafe';
import {
    DB_ID_TO_SEARCH_ENTITY_TYPE,
    ISearchQuery,
    type ISearchExplanation,
    type ISearchExplanationAppearance,
    type ISearchExplanationItem,
    type ISearchExplanationNearestItem,
    SearchEntityType,
    SearchMatchReason
} from '@msdining/common/models/search';
import { fuzzySearch, normalizeNameForSearch } from '@msdining/common/util/search-util';
import { getCafeNumber } from '@msdining/common/util/cafe-util';
import { getEntityKeyFromParts } from '@msdining/common/util/entity-key';
import { ICheapItemSearchResult, IServerSearchResult } from '../../../shared/models/search.js';
import { Nullable } from '../../../shared/models/util.js';
import { getLogoUrl, getStationLogoUrl, getThumbnailUrl } from '../../../shared/util/cafe.js';
import * as vectorClient from './vector/client.js';
import { IVectorSearchResult } from '../../../shared/models/vector.js';
import { logDebug } from '../../../shared/util/log.js';
import { ALL_CAFES, CAFE_GROUP_LIST, CAFES_BY_ID } from '../../../shared/constants/cafes.js';
import { MaybePromise } from '../../../shared/models/async.js';
import { ensureThumbnailDataHasBeenRetrievedAsync } from '../../interface/thumbnail.js';
import { ICafe } from '../../../shared/models/cafe.js';
import { getServices } from '../../../shared/services/registry.js';

import { NON_ENTREE_FILTER } from '../../../shared/util/menu-item-filter.js';
import { shouldPromoteByHitRate, getAverageDistance, type IStationHitStats } from './search-hit-rate.js';
import { MenuItemStorageClient } from './clients/menu-item/menu-item.js';

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
    groupId: Nullable<string>;
    type: SearchEntityType;
    matchReasons: Iterable<SearchMatchReason>;
    name: string;
    cafeId: string;
    station: Nullable<string>;
    price: Nullable<number>;
    description: Nullable<string>;
    imageUrl: Nullable<string> | (() => MaybePromise<Nullable<string>>);
    tags: Nullable<Set<string>>;
    searchTags: Nullable<Set<string>>;
    matchedModifiers?: Map<string, Set<string>>;
    vectorDistance?: number;
}

interface IAddResultParamsWithoutAppearance extends IAddResultParamsBase {
    dateString: undefined;
}

interface IAddResultParamsWithAppearance extends IAddResultParamsBase {
    dateString: string;
}

interface IAddResultParamsForCafe extends IAddResultParamsBase {
    type: SearchEntityType.cafe;
    dateString: undefined;
}

type IAddResultParams = IAddResultParamsWithoutAppearance | IAddResultParamsWithAppearance | IAddResultParamsForCafe;

interface ISimilarEntitySearchParams {
    entityType: SearchEntityType;
    entityName: string;
    date: Date;
}

const createMenuItemImageUrlGetter = (menuItem: IMenuItemBase): (() => MaybePromise<Nullable<string>>) => {
    return async () => {
        await ensureThumbnailDataHasBeenRetrievedAsync(menuItem);
        return getThumbnailUrl(menuItem);
    };
}

// The vector index stores one embedding per menu-item id, so a dish offered in N
// cafes yields N near-identical neighbors that share a single entityKey. We
// over-fetch raw neighbors and collapse them to distinct entityKeys (keeping the
// closest instance) so the top-K budget holds distinct dishes rather than dupes.
// The KNN cost is dominated by the full-index scan, so a larger raw limit is
// effectively free (see server/src/adhoc/bench-vector-search.ts).
const VECTOR_SEARCH_DISTINCT_LIMIT = 50;
const VECTOR_SEARCH_OVERFETCH_MULTIPLIER = 4;
const VECTOR_SEARCH_RAW_LIMIT = VECTOR_SEARCH_DISTINCT_LIMIT * VECTOR_SEARCH_OVERFETCH_MULTIPLIER;

interface IDedupedVectorResults {
    // Keyed by entityKey for menu items (group:<id> or name:<normalized>), and by
    // id for other entity types (which have no entityKey concept here).
    bestDistanceByEntityKey: Map<SearchEntityType, Map<string, number>>;
    representativeIdByEntityKey: Map<SearchEntityType, Map<string, string>>;
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
        groupId,
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
        const id = groupId ? groupId : `no-group-${normalizeNameForSearch(name)}`;

        if (!searchResultsById.has(id)) {
            searchResultsById.set(id, {
                type,
                name,
                description,
                imageUrl,
                vectorDistance,
                groupId:               groupId || undefined,
                tags:                  tags || undefined,
                searchTags:            searchTags || undefined,
                locationDatesByCafeId: new Map<string, Set<string>>(),
                priceByCafeId:         new Map<string, number>(),
                stationByCafeId:       new Map<string, string>(),
                matchReasons:          new Set<SearchMatchReason>(),
                matchedModifiers:      new Map<string, Set<string>>(),
                entityKey:             getEntityKeyFromParts(groupId, normalizeNameForSearch(name)),
            });
        }

        const searchResult = searchResultsById.get(id)!;

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
                if (dateString) {
                    if (!searchResult.locationDatesByCafeId.has(cafeId)) {
                        searchResult.locationDatesByCafeId.set(cafeId, new Set());
                    }
                    searchResult.locationDatesByCafeId.get(cafeId)!.add(dateString);
                }

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
        return getServices().data.dailyMenu.getMenusForSearch({ date: this.date });
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

    promoteResult(type: SearchEntityType, name: string, overrides?: Partial<Pick<IAddResultParams, 'vectorDistance'>>) {
        const pending = this.#pendingSearchResults.get(type, name);
        if (pending) {
            this.#searchResults.set(type, name, pending);
            this.#pendingSearchResults.delete(type, name);
            pending.matchReasons.add(SearchMatchReason.childItemMatch);
            if (overrides?.vectorDistance != null) {
                pending.vectorDistance = overrides.vectorDistance;
            }
        }
    }

    getMenuItemMatch(menuItem: IMenuItemBase) {
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

    getCafeMatch(cafe: { name: string; shortName?: string | number; emoji?: string, id?: string }, groupName?: string) {
        const matchReasons = new Set<SearchMatchReason>();

        // Check cafe name
        if (this.isMatch(cafe.name, SearchEntityType.cafe)) {
            matchReasons.add(SearchMatchReason.title);
        }

        const cafeNumber = getCafeNumber(cafe.name);
        if (!Number.isNaN(cafeNumber) && this.isMatch(String(cafeNumber), SearchEntityType.cafe)) {
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

        if (cafe.id && this.isMatch(String(cafe.id), SearchEntityType.cafe)) {
            matchReasons.add(SearchMatchReason.title);
        }

        return { matchReasons } as const;
    }

    async registerCafe(isMatch: boolean, cafe: ICafe) {
        const group = CAFE_GROUP_LIST.find(group => group.members.some(member => member.id === cafe.id));
        if (!group) {
            logDebug('No group found for cafe', cafe.id);
            return;
        }

        // Find the group this cafe belongs to
        const { matchReasons } = this.getCafeMatch(cafe, group.name);

        // Get cafe config for logo
        const cafeConfig = await getServices().data.cafe.retrieveCafe({ id: cafe.id });

        if (!cafeConfig) {
            logDebug('Cafe config not found for vector result', cafe.id);
            return;
        }

        this.registerResult(isMatch || matchReasons.size > 0, {
            type:        SearchEntityType.cafe,
            groupId:     undefined,
            dateString:  undefined,
            cafeId:      cafe.id,
            name:        cafe.name,
            description: undefined,
            imageUrl:    getLogoUrl(cafe, cafeConfig),
            // No pricing/station data for cafes
            price:            undefined,
            searchTags:       undefined,
            tags:             undefined,
            station:          undefined,
            matchReasons,
            matchedModifiers: new Map()
        });
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
                groupId:      stationData.groupId,
                price:       undefined,
                searchTags:  undefined,
                tags:        undefined,
                description: undefined,
                station:     undefined
            });

            const stationStats: IStationHitStats = { matchedCount: 0, totalCount: 0, distanceCount: 0, totalDistance: 0 };

            for (const category of dailyStation.categories) {
                for (const dailyMenuItem of category.menuItems) {
                    const menuItem = await getServices().data.menuItem.retrieveMenuItem({ id: dailyMenuItem.menuItemId });

                    if (menuItem == null) {
                        continue;
                    }

                    stationStats.totalCount++;

                    const { matchReasons, matchedModifiers } = session.getMenuItemMatch(menuItem);
                    const isItemMatch = matchReasons.size > 0;

                    if (isItemMatch) {
                        stationStats.matchedCount++;
                    }

                    session.registerResult(isItemMatch, {
                        type:        SearchEntityType.menuItem,
                        dateString:  dailyStation.dateString,
                        cafeId:      dailyStation.cafeId,
                        groupId:     menuItem.groupId,
                        name:        menuItem.name,
                        description: menuItem.description,
                        price:       menuItem.price,
                        tags:        menuItem.tags,
                        searchTags:  menuItem.searchTags,
                        station:     stationData.name,
                        imageUrl:    createMenuItemImageUrlGetter(menuItem),
                        matchReasons,
                        matchedModifiers
                    });
                }
            }

            if (stationMatchReasons.size === 0 && shouldPromoteByHitRate(stationStats)) {
                session.promoteResult(SearchEntityType.station, stationData.name);
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

    /**
     * Collapses raw vector neighbors (which may contain several ids for the same
     * dish across cafes) down to distinct entityKeys, keeping the closest instance
     * of each. entityKey is resolved live from the menu-item source of truth so it
     * never goes stale on group join/leave. Other entity types are keyed by id.
     */
    private static async _dedupeVectorResultsByEntityKey(rawResults: IVectorSearchResult[], distinctLimit: number): Promise<IDedupedVectorResults> {
        const sorted = [...rawResults].sort((resultA, resultB) => resultA.distance - resultB.distance);

        const entityKeys = await Promise.all(sorted.map(async result => {
            const entityType = DB_ID_TO_SEARCH_ENTITY_TYPE[result.entity_type] as SearchEntityType;
            if (!entityType) {
                throw new Error(`Invalid entity type: ${result.entity_type}`);
            }

            if (entityType === SearchEntityType.menuItem) {
                const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(result.id);
                return menuItem?.entityKey ?? null;
            }

            return result.id;
        }));

        const bestDistanceByEntityKey = new Map<SearchEntityType, Map<string, number>>();
        const representativeIdByEntityKey = new Map<SearchEntityType, Map<string, string>>();

        for (let i = 0; i < sorted.length; i++) {
            const result = sorted[i]!;
            const entityKey = entityKeys[i];
            if (entityKey == null) {
                continue;
            }

            const entityType = DB_ID_TO_SEARCH_ENTITY_TYPE[result.entity_type] as SearchEntityType;

            let distanceByEntityKey = bestDistanceByEntityKey.get(entityType);
            if (distanceByEntityKey == null) {
                distanceByEntityKey = new Map();
                bestDistanceByEntityKey.set(entityType, distanceByEntityKey);
                representativeIdByEntityKey.set(entityType, new Map());
            }

            // sorted ascending, so the first time we see a key is its min distance.
            if (distanceByEntityKey.has(entityKey) || distanceByEntityKey.size >= distinctLimit) {
                continue;
            }

            distanceByEntityKey.set(entityKey, result.distance);
            representativeIdByEntityKey.get(entityType)!.set(entityKey, result.id);
        }

        return { bestDistanceByEntityKey, representativeIdByEntityKey };
    }

    private static async _searchVectorInner(query: string, date: Date | null, doVectorSearch: () => Promise<IDedupedVectorResults>, allowResultsWithoutAppearances: boolean): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> {
        const session = new SearchSession({
            queries:             [{ text: query }],
            shouldUseExactMatch: false,
            date,
        });

        const [{ bestDistanceByEntityKey, representativeIdByEntityKey }, menus] = await Promise.all([
            doVectorSearch(),
            session.getMenusAsync()
        ]);

        const vectorFoundItemsWithoutAppearances = new Map<SearchEntityType, Set<string /*entityKey*/>>();
        for (const [entityType, distanceByEntityKey] of bestDistanceByEntityKey) {
            vectorFoundItemsWithoutAppearances.set(entityType, new Set(distanceByEntityKey.keys()));
        }

        const getVectorDistanceAndMarkSeen = (entityType: SearchEntityType, entityKey: string) => {
            const distanceByEntityKey = bestDistanceByEntityKey.get(entityType);
            if (distanceByEntityKey == null) {
                return undefined;
            }

            vectorFoundItemsWithoutAppearances.get(entityType)?.delete(entityKey);
            return distanceByEntityKey.get(entityKey);
        };

        const cafeHitStats = new Map<string /*cafeId*/, IStationHitStats>();

        for (const { dateString, cafeId, station, categories } of menus) {
            const { matchReasons: stationMatchReasons } = session.getStationMatch(station.name);

            session.registerResult(
                stationMatchReasons.size > 0,
                {
                    type:           SearchEntityType.station,
                    matchReasons:   stationMatchReasons,
                    dateString:     dateString,
                    cafeId:         cafeId,
                    name:           station.name,
                    imageUrl:       getStationLogoUrl(station.name, station.logoUrl),
                    vectorDistance: undefined,
                    groupId:        station.groupId,
                    // No data for stations
                    price:       undefined,
                    searchTags:  undefined,
                    tags:        undefined,
                    description: undefined,
                    station:     undefined
                });

            const stationStats: IStationHitStats = { matchedCount: 0, totalCount: 0, distanceCount: 0, totalDistance: 0 };

            for (const category of categories) {
                for (const dailyMenuItem of category.menuItems) {
                    const menuItem = await getServices().data.menuItem.retrieveMenuItem({ id: dailyMenuItem.menuItemId });
                    if (menuItem == null) {
                        continue;
                    }

                    stationStats.totalCount++;

                    const menuItemDistance = getVectorDistanceAndMarkSeen(SearchEntityType.menuItem, menuItem.entityKey);

                    const { matchReasons, matchedModifiers } = session.getMenuItemMatch(menuItem);

                    const exactMatchCandidates: Array<Nullable<string>> = [
                        menuItem.name,
                        menuItem.description,
                        ...menuItem.searchTags,
                        ...menuItem.tags,
                        ...menuItem.modifiers.flatMap(modifier => [modifier.description, ...modifier.choices.map(choice => choice.description)])
                    ];

                    const isItemMatch = session.isVectorMatch(menuItemDistance, SearchEntityType.menuItem, exactMatchCandidates);

                    if (isItemMatch) {
                        stationStats.matchedCount++;
                        if (menuItemDistance != null) {
                            stationStats.distanceCount++;
                            stationStats.totalDistance += menuItemDistance;
                        }
                    }

                    session.registerResult(
                        isItemMatch,
                        {
                            type:             SearchEntityType.menuItem,
                            dateString:       dateString,
                            cafeId:           cafeId,
                            groupId:          menuItem.groupId,
                            name:             menuItem.name,
                            description:      menuItem.description,
                            price:            menuItem.price,
                            tags:             menuItem.tags,
                            searchTags:       menuItem.searchTags,
                            imageUrl:         createMenuItemImageUrlGetter(menuItem),
                            station:          station.name,
                            matchReasons:     matchReasons,
                            matchedModifiers: matchedModifiers,
                            vectorDistance:   menuItemDistance,
                        });
                }
            }

            // Promote station if enough items matched
            if (stationMatchReasons.size === 0 && shouldPromoteByHitRate(stationStats)) {
                session.promoteResult(SearchEntityType.station, station.name, {
                    vectorDistance: getAverageDistance(stationStats),
                });
            }

            // Accumulate cafe-level stats
            const cafeStats = cafeHitStats.get(cafeId) ?? { matchedCount: 0, totalCount: 0, distanceCount: 0, totalDistance: 0 };
            cafeStats.matchedCount += stationStats.matchedCount;
            cafeStats.totalCount += stationStats.totalCount;
            cafeStats.distanceCount += stationStats.distanceCount;
            cafeStats.totalDistance += stationStats.totalDistance;
            cafeHitStats.set(cafeId, cafeStats);
        }

        for (const cafe of ALL_CAFES) {
            const stats = cafeHitStats.get(cafe.id);
            await session.registerCafe(stats != null && shouldPromoteByHitRate(stats), cafe);
        }

        if (allowResultsWithoutAppearances) {
            for (const [entityType, entityKeys] of vectorFoundItemsWithoutAppearances) {
                const representativeIds = representativeIdByEntityKey.get(entityType);
                for (const entityKey of entityKeys) {
                    const representativeId = representativeIds?.get(entityKey);
                    if (representativeId == null) {
                        continue;
                    }

                    if (entityType === SearchEntityType.menuItem) {
                        // todo: find the last appearance maybe? would be nice to have cafe/station data.
                        const menuItem = await getServices().data.menuItem.retrieveMenuItem({ id: representativeId });
                        if (menuItem != null) {
                            logDebug('Adding vector menu item result without appearance', menuItem.name);
                            const { matchReasons, matchedModifiers } = session.getMenuItemMatch(menuItem);
                            session.registerResult(true /*isMatch*/, {
                                type:        SearchEntityType.menuItem,
                                dateString:  undefined,
                                cafeId:      menuItem.cafeId,
                                groupId:     menuItem.groupId,
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
                        // For cafes the entityKey is the cafe id.
                        const cafe = CAFES_BY_ID.get(representativeId);
                        if (cafe != null) {
                            logDebug('Adding vector cafe result without appearance', cafe.name);
                            await session.registerCafe(true /*isMatch*/, cafe);
                        } else {
                            logDebug('Cafe not found for vector result', representativeId);
                        }
                    }
                }
            }
        }

        return session.results;
    }

    public static async searchVector(query: string, date: Date | null, allowResultsWithoutAppearances: boolean): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> {
        return SearchManager._searchVectorInner(
            query,
            date,
            async () => SearchManager._dedupeVectorResultsByEntityKey(
                await vectorClient.searchVectorRawFromQuery(query, VECTOR_SEARCH_RAW_LIMIT),
                VECTOR_SEARCH_DISTINCT_LIMIT
            ),
            allowResultsWithoutAppearances
        );
    }

    /**
     * Diagnostic for the search-explain debug tool: explains why a given menu item
     * (by id or by name) did or did not match a query. Reuses the same building
     * blocks as the real search — the vector top-K, SearchSession.getMenuItemMatch,
     * isVectorMatch, isExactSubstring, getMenusForSearch, and the real searchVector
     * output as ground truth — so it stays in sync if the search logic changes.
     */
    public static async explainSearch(
        query: string,
        target: { menuItemId?: string; name?: string },
        date: Date | null,
        allowResultsWithoutAppearances: boolean,
    ): Promise<ISearchExplanation> {
        const session = new SearchSession({ queries: [{ text: query }], shouldUseExactMatch: false, date });
        const normalizedQuery = normalizeNameForSearch(query);

        const targetItems = target.menuItemId
            ? [await MenuItemStorageClient.retrieveMenuItemAsync(target.menuItemId)].filter((item): item is IMenuItemBase => item != null)
            : target.name
                ? await MenuItemStorageClient.getMenuItemsByNormalizedName(target.name)
                : [];

        const [rawResults, realResults, menus] = await Promise.all([
            vectorClient.searchVectorRawFromQuery(query, VECTOR_SEARCH_RAW_LIMIT),
            SearchManager.searchVector(query, date, allowResultsWithoutAppearances),
            session.getMenusAsync(),
        ]);

        // De-dupe the raw neighbors to distinct entityKeys exactly like real search,
        // so the explained ranks/cutoff and the "nearest items" list reflect distinct
        // dishes rather than the same dish repeated across cafes.
        const deduped = await SearchManager._dedupeVectorResultsByEntityKey(rawResults, VECTOR_SEARCH_DISTINCT_LIMIT);
        const distanceByEntityKey = deduped.bestDistanceByEntityKey.get(SearchEntityType.menuItem) ?? new Map<string, number>();
        const representativeIdByEntityKey = deduped.representativeIdByEntityKey.get(SearchEntityType.menuItem) ?? new Map<string, string>();

        // Distinct menu-item entityKeys ordered by distance; an item is "retrieved by
        // vector" iff its entityKey lands inside this de-duped window.
        const sortedEntityKeys = [...distanceByEntityKey.entries()].sort((entryA, entryB) => entryA[1] - entryB[1]);
        const topKSize = sortedEntityKeys.length;
        const worstIncludedDistance = topKSize > 0 ? sortedEntityKeys[topKSize - 1]![1] : null;

        const rankByEntityKey = new Map<string, number>();
        sortedEntityKeys.forEach(([entityKey], index) => rankByEntityKey.set(entityKey, index + 1));

        const nearestMenuItems: ISearchExplanationNearestItem[] = await Promise.all(
            sortedEntityKeys.slice(0, 15).map(async ([entityKey, distance], index) => {
                const representativeId = representativeIdByEntityKey.get(entityKey)!;
                const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(representativeId);
                return {
                    menuItemId: representativeId,
                    name:       menuItem?.name ?? null,
                    distance,
                    rank:       index + 1,
                };
            }),
        );

        const appearancesByMenuItemId = new Map<string, ISearchExplanationAppearance[]>();
        for (const { dateString, cafeId, station, categories } of menus) {
            for (const category of categories) {
                for (const dailyMenuItem of category.menuItems) {
                    const appearances = appearancesByMenuItemId.get(dailyMenuItem.menuItemId) ?? [];
                    appearances.push({ cafeId, dateString, stationName: station.name });
                    appearancesByMenuItemId.set(dailyMenuItem.menuItemId, appearances);
                }
            }
        }

        // Match against the result's entityKey (group:<id> or name:<normalized>),
        // not the display name — the real results are bucketed by group, and a
        // bucket stores only its first item's name, so a name comparison would
        // both miss grouped members and falsely match same-name items in other
        // cafes. entityKey is exactly the bucket identity.
        const finalMenuItemEntityKeys = new Set<string>();
        for (const result of realResults.get(SearchEntityType.menuItem)?.values() ?? []) {
            finalMenuItemEntityKeys.add(result.entityKey);
        }

        const items: ISearchExplanationItem[] = await Promise.all(targetItems.map(menuItem =>
            SearchManager._explainMenuItem({
                session,
                menuItem,
                query,
                date,
                allowResultsWithoutAppearances,
                topKSize,
                worstIncludedDistance,
                vectorRank: rankByEntityKey.get(menuItem.entityKey) ?? null,
                topKDistance: distanceByEntityKey.get(menuItem.entityKey),
                appearances: appearancesByMenuItemId.get(menuItem.id) ?? [],
                isInFinalResults: finalMenuItemEntityKeys.has(menuItem.entityKey),
            }),
        ));

        return {
            query,
            normalizedQuery,
            date:        date ? date.toISOString() : null,
            allowResultsWithoutAppearances,
            vectorTopKSize: topKSize,
            worstIncludedDistance,
            items,
            nearestMenuItems,
        };
    }

    private static async _explainMenuItem({
        session,
        menuItem,
        query,
        date,
        allowResultsWithoutAppearances,
        topKSize,
        worstIncludedDistance,
        vectorRank,
        topKDistance,
        appearances,
        isInFinalResults,
    }: {
        session: SearchSession;
        menuItem: IMenuItemBase;
        query: string;
        date: Date | null;
        allowResultsWithoutAppearances: boolean;
        topKSize: number;
        worstIncludedDistance: number | null;
        vectorRank: number | null;
        topKDistance: number | undefined;
        appearances: ISearchExplanationAppearance[];
        isInFinalResults: boolean;
    }): Promise<ISearchExplanationItem> {
        const cosineDistance = await vectorClient.getQueryEntityCosineDistance(query, SearchEntityType.menuItem, menuItem.id);
        const cosineSimilarity = cosineDistance != null ? 1 - cosineDistance : null;
        const isInVectorTopK = vectorRank != null;

        // The vector top-K is de-duped to distinct dishes by entityKey, so the rank
        // belongs to the dish and is set by its closest cross-cafe instance. That
        // representative distance — not this exact instance's cosineDistance — is the
        // value consistent with vectorRank / the cutoff.
        const representativeCosineDistance = topKDistance ?? null;
        const representativeCosineSimilarity = representativeCosineDistance != null ? 1 - representativeCosineDistance : null;
        const isClosestInstance = cosineDistance == null || representativeCosineDistance == null
            || Math.abs(cosineDistance - representativeCosineDistance) < 1e-9;

        const { matchReasons } = session.getMenuItemMatch(menuItem);

        const exactMatchCandidates: Array<Nullable<string>> = [
            menuItem.name,
            menuItem.description,
            ...menuItem.searchTags,
            ...menuItem.tags,
            ...menuItem.modifiers.flatMap(modifier => [modifier.description, ...modifier.choices.map(choice => choice.description)]),
        ];
        const isExactSubstringMatch = exactMatchCandidates.some(candidate => candidate != null && session.isExactSubstring(candidate, SearchEntityType.menuItem));

        const isVectorMatch = session.isVectorMatch(topKDistance, SearchEntityType.menuItem, exactMatchCandidates);
        const appearsInSearchWindow = appearances.length > 0;
        const wouldRegisterAsMatch = isVectorMatch || matchReasons.size > 0;

        const windowLabel = date ? `selected date's` : `current week's`;
        const formatSimilarity = (value: number | null) => value == null ? 'n/a' : value.toFixed(3);

        const reasons: string[] = [];
        if (cosineDistance == null) {
            reasons.push('This item has no embedding, so vector search can never surface it.');
        }

        if (isInFinalResults) {
            if (isInVectorTopK) {
                if (isClosestInstance) {
                    reasons.push(`Matched by vector similarity (rank ${vectorRank} of ${topKSize}, cosine similarity ${formatSimilarity(representativeCosineSimilarity)}).`);
                } else {
                    reasons.push(`Matched by vector similarity: this dish ranks ${vectorRank} of ${topKSize} via its closest cross-cafe instance (cosine similarity ${formatSimilarity(representativeCosineSimilarity)}); this specific item's cosine similarity is ${formatSimilarity(cosineSimilarity)}.`);
                }
            }
            if (matchReasons.size > 0) {
                reasons.push(`Matched by text on: ${[...matchReasons].join(', ')}.`);
            } else if (isExactSubstringMatch && !isInVectorTopK) {
                reasons.push('Matched by exact substring fallback.');
            }
            // The result bucket is shared across a cross-cafe group / same name, so it
            // can be in the results because a sibling item matched even though this
            // specific item did not match or does not appear in the window.
            if (!isInVectorTopK && matchReasons.size === 0 && !isExactSubstringMatch) {
                reasons.push('Included via a sibling item that shares this group/name; this specific item did not match directly (see signals).');
            }
        } else {
            if (!isInVectorTopK) {
                const cutoff = worstIncludedDistance != null ? `, below the top-${topKSize} cutoff similarity of ${formatSimilarity(1 - worstIncludedDistance)}` : '';
                reasons.push(`Not in the vector top ${topKSize} (cosine similarity ${formatSimilarity(cosineSimilarity)}${cutoff}).`);
            } else if (!appearsInSearchWindow && !allowResultsWithoutAppearances) {
                reasons.push(`In the vector top ${topKSize} (rank ${vectorRank}) but does not appear in the ${windowLabel} menu, and results without an appearance are not allowed for this search.`);
            }

            if (matchReasons.size === 0 && !isExactSubstringMatch) {
                reasons.push('No text match on name, description, tags, search tags, or modifiers.');
            }

            if (!appearsInSearchWindow && !isInVectorTopK) {
                reasons.push(`Does not appear in the ${windowLabel} menu.`);
            }
        }

        return {
            menuItemId: menuItem.id,
            name:       menuItem.name,
            cafeId:     menuItem.cafeId,
            stationId:  menuItem.stationId,
            hasEmbedding: cosineDistance != null,
            cosineDistance,
            cosineSimilarity,
            representativeCosineDistance,
            representativeCosineSimilarity,
            vectorRank,
            isInVectorTopK,
            nameMatchReasons: [...matchReasons],
            isExactSubstringMatch,
            appearsInSearchWindow,
            appearances,
            isVectorMatch,
            wouldRegisterAsMatch,
            isInFinalResults,
            reasons,
        };
    }

    public static async searchForSimilarEntities({
        entityName: _entityName,
        entityType: _entityType,
        date: _date,
    }: ISimilarEntitySearchParams): Promise<Map<SearchEntityType, Map<string, IServerSearchResult>>> {
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
        const dailyStations = await getServices().data.dailyMenu.getMenusForSearch({ date });

        const resultsByItemNameByPrice = new Map<string, Map<number, ICheapItemSearchResult>>();

        for (const dailyStation of dailyStations) {
            if (NON_ENTREE_FILTER.matchesStationOrCategory(dailyStation.station.name)) {
                continue;
            }

            for (const category of dailyStation.categories) {
                if (NON_ENTREE_FILTER.matchesStationOrCategory(category.name)) {
                    continue;
                }

                for (const dailyMenuItem of category.menuItems) {
                    const menuItem = await getServices().data.menuItem.retrieveMenuItem({ id: dailyMenuItem.menuItemId });

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

                    if (NON_ENTREE_FILTER.matchesItemText(menuItem.name)) {
                        continue;
                    }

                    if (menuItem.description && NON_ENTREE_FILTER.matchesItemText(menuItem.description)) {
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
                            imageUrl:    createMenuItemImageUrlGetter(menuItem),
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