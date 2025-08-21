import { isDuckType, isDuckTypeArray } from '@arcticzeroo/typeguard';
import { DateUtil, SearchTypes } from '@msdining/common';
import { ICafeOverviewStation, IMenuItemBase, IMenuItem } from '@msdining/common/dist/models/cafe';
import {
    ICreateReviewRequest,
    IDiningCoreResponse,
    ISearchResponseResult, IUpdateUserSettingsInput,
    IWaitTimeResponse,
    MenuResponse
} from '@msdining/common/dist/models/http';
import { ISearchQuery, SEARCH_ENTITY_TYPE_NAME_TO_ENUM, SearchEntityType } from '@msdining/common/dist/models/search';
import { DebugSettings, InternalSettings } from '../constants/settings.ts';
import { CafeMenu, CafeView, ICafe, ICafeStation } from '../models/cafe.ts';
import { ICheapItemSearchResult, IQuerySearchResult, IServerCheapItemSearchResult, } from '../models/search.ts';
import { ICancellationToken, pause } from '../util/async.ts';
import { sortCafesInPriorityOrder } from '../util/sorting.ts';
import { FavoritesCache } from './cache/favorites.ts';
import { JSON_HEADERS, makeJsonRequest, makeJsonRequestNoParse } from './request.ts';
import { IEntityVisitData } from '@msdining/common/dist/models/pattern';
import { IClientUser, IClientUserDTO } from '@msdining/common/dist/models/auth';
import { IReview, IReviewDataForMenuItem } from '@msdining/common/dist/models/review';

const TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS = 1000;

interface IRetrieveCafeMenuParams {
    id: string;
    date?: Date;
    shouldCountTowardsLastUsed?: boolean;
}

interface IRetrieveSearchResultsParams {
    query: string;
    date?: Date;
    isExact?: boolean;
    isExplore?: boolean;
    onlyAvailableResults?: boolean;
}

export abstract class DiningClient {
    private static readonly _cafeMenusByIdPerDateString: Map<string, Map<string, Promise<CafeMenu>>> = new Map();
    private static readonly _favoritesCache = new FavoritesCache();

    public static async retrieveCoreData(): Promise<IDiningCoreResponse> {
        const response = await makeJsonRequest({
            path: '/api/dining'
        });

        if (!isDuckType<IDiningCoreResponse>(response, { groups: 'object', isTrackingEnabled: 'boolean' })) {
            throw new Error('Response is not in the expected format');
        }

        return response;
    }

    private static async _retrieveCafeMenuInner(id: string, dateString: string): Promise<Array<ICafeStation>> {
        const response = await makeJsonRequest({
            path: `/api/dining/menu/${id}?date=${dateString}`
        }) as MenuResponse;

        const stations: ICafeStation[] = [];
        for (const responseStation of response) {
            const menu: Record<string, Array<IMenuItem>> = {};
            for (const [category, menuItems] of Object.entries(responseStation.menu)) {
                menu[category] = menuItems.map(dto => ({
                    ...dto,
                    lastUpdateTime: dto.lastUpdateTime ? new Date(dto.lastUpdateTime) : undefined,
                    tags: new Set(dto.tags),
                    searchTags: new Set(dto.searchTags)
                } satisfies IMenuItemBase));
            }

            stations.push({
                ...responseStation,
                menu
            });
        }

        return stations;
    }

    private static _addToLastUsedCafeIds(id: string) {
        // Most recently used IDs are at the end of the list.
        InternalSettings.lastUsedCafeIds.value = [
            ...InternalSettings.lastUsedCafeIds.value.filter(existingId => existingId !== id),
            id
        ];
    }

    public static getTodayDateForMenu() {
        return DateUtil.ensureDateIsNotWeekendForMenu(new Date());
    }

    public static async retrieveCafeMenu({
        id,
        shouldCountTowardsLastUsed,
        date,
    }: IRetrieveCafeMenuParams): Promise<CafeMenu> {
        const dateString = DateUtil.toDateString(date ?? DiningClient.getTodayDateForMenu());

        try {
            if (!DiningClient._cafeMenusByIdPerDateString.has(dateString)) {
                DiningClient._cafeMenusByIdPerDateString.set(dateString, new Map());
            }

            const cafeMenusById = DiningClient._cafeMenusByIdPerDateString.get(dateString)!;
            if (!cafeMenusById.has(id)) {
                cafeMenusById.set(id, DiningClient._retrieveCafeMenuInner(id, dateString));
            }

            const menu = await cafeMenusById.get(id)!;

            // Wait until retrieving successfully first so that we avoid holding a bunch of invalid cafes
            if (shouldCountTowardsLastUsed) {
                DiningClient._addToLastUsedCafeIds(id);
            }

            return menu;
        } catch (err) {
            DiningClient._cafeMenusByIdPerDateString.get(dateString)?.delete(id);
            throw err;
        }
    }

    public static async retrieveCafeMenuOverview(cafe: ICafe, dateString: string): Promise<Array<ICafeOverviewStation>> {
        const makeRequest = async () => {
            const response = await makeJsonRequest({
                path: `/api/dining/menu/${cafe.id}/overview?date=${dateString}`
            });

            return response as Array<ICafeOverviewStation>;
        };

        const overviewPromise = makeRequest();

        const existingMenuPromise = DiningClient._cafeMenusByIdPerDateString.get(dateString)?.get(cafe.id);
        if (existingMenuPromise) {
            return Promise.race([
                overviewPromise,
                existingMenuPromise
            ]);
        }

        return overviewPromise;
    }

    public static async retrieveRecentMenusInOrder(cafes: ICafe[], viewsById: Map<string, CafeView>, cancellationToken?: ICancellationToken) {
        console.log('Retrieving cafe menus...');
        const priorityOrder = sortCafesInPriorityOrder(cafes, viewsById);

        for (const cafe of priorityOrder.slice(0, 5)) {
            await pause(TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS);

            if (cancellationToken?.isCancelled) {
                break;
            }

            await DiningClient.retrieveCafeMenu({
                id: cafe.id,
                shouldCountTowardsLastUsed: false
            });
        }
    }

    public static getThumbnailUrlForMenuItem(menuItem: IMenuItemBase) {
        return `/static/menu-items/thumbnail/${menuItem.id}.png`;
    }

    public static isMenuProbablyOutdated(selectedDate: Date): boolean {
        const nowInLocalTime = new Date();
        const nowInPacificTime = new Date(nowInLocalTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));

        if (DateUtil.isDateBefore(nowInPacificTime, selectedDate)) {
            return true;
        }

        if (DateUtil.isDateAfter(nowInPacificTime, selectedDate)) {
            return false;
        }

        // Menu is updated at 9am Pacific Time. Menus for things like boardwalk/craft75 might be valid until around 8pm.
        return nowInPacificTime.getHours() < 9;
    }

    private static _deserializeLocationDatesByCafeId(serialized: { [cafeId: string]: Array<string> }) {
        const locationDatesByCafeId = new Map<string, Array<Date>>();
        for (const [cafeId, dateStrings] of Object.entries(serialized)) {
            const dates = dateStrings.map(DateUtil.fromDateString).sort((a, b) => a.getTime() - b.getTime());
            locationDatesByCafeId.set(cafeId, dates);
        }
        return locationDatesByCafeId;
    }

    private static _deserializeMatchedModifiers(serialized: Record<string, Array<string>>) {
        const matchedModifiers = new Map<string, Set<string>>();
        for (const [modifierDescription, choiceDescriptions] of Object.entries(serialized)) {
            matchedModifiers.set(modifierDescription, new Set(choiceDescriptions));
        }
        return matchedModifiers;
    }

    private static _deserializeSearchResults(response: unknown) {
        if (!Array.isArray(response) || response.length === 0) {
            return [];
        }

        const serverResults = response as Array<ISearchResponseResult>;
        const results: Array<IQuerySearchResult> = [];

        for (const serverResult of serverResults) {
            const entityType = SEARCH_ENTITY_TYPE_NAME_TO_ENUM[serverResult.type];

            results.push({
                entityType,
                name: serverResult.name,
                description: serverResult.description,
                imageUrl: serverResult.imageUrl,
                locationDatesByCafeId: DiningClient._deserializeLocationDatesByCafeId(serverResult.locations),
                priceByCafeId: new Map(Object.entries(serverResult.prices)),
                stationByCafeId: new Map(Object.entries(serverResult.stations)),
                matchReasons: new Set(serverResult.matchReasons),
                tags: serverResult.tags ? new Set(serverResult.tags) : undefined,
                searchTags: serverResult.searchTags ? new Set(serverResult.searchTags) : undefined,
                matchedModifiers: DiningClient._deserializeMatchedModifiers(serverResult.matchedModifiers),
                vectorDistance: serverResult.vectorDistance,
                cafeId: serverResult.cafeId || undefined
            });
        }

        return results;
    }

    public static async retrieveSearchResults({
        query,
        date,
        isExact = false,
        isExplore = false,
        onlyAvailableResults = false
    }: IRetrieveSearchResultsParams): Promise<Array<IQuerySearchResult>> {
        const searchParams = new URLSearchParams();

        searchParams.set('q', query);

        if (isExact) {
            searchParams.set('e', 'true');
        }

        if (isExplore) {
            searchParams.set('exp', 'true');
        }

        if (onlyAvailableResults) {
            searchParams.set('availableOnly', 'true');
        }

        if (DebugSettings.noVectorSearch.value) {
            searchParams.set('nv', 'true');
        }

        if (date != null) {
            searchParams.set('date', DateUtil.toDateString(date));
        }

        const response = await makeJsonRequest({
            path: `/api/dining/search?${searchParams.toString()}`
        });

        return DiningClient._deserializeSearchResults(response);
    }

    public static async retrieveFavoriteSearchResults(queries: Array<SearchTypes.ISearchQuery>, date?: Date): Promise<Array<IQuerySearchResult>> {
        const results: IQuerySearchResult[] = [];
        const remoteQueries: ISearchQuery[] = [];

        for (const query of queries) {
            const localResult = DiningClient._favoritesCache.get(query);
            if (localResult != null) {
                results.push(localResult);
            } else {
                remoteQueries.push(query);
            }
        }

        const response = await makeJsonRequest({
            path: `/api/dining/search/favorites${date != null ? `?date=${DateUtil.toDateString(date)}` : ''}`,
            options: {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify(remoteQueries)
            }
        });

        for (const result of DiningClient._deserializeSearchResults(response)) {
            DiningClient._favoritesCache.addToCache(result);
            results.push(result);
        }

        return results;
    }

    public static async retrieveCheapItems(date?: Date): Promise<Array<ICheapItemSearchResult>> {
        const response = await makeJsonRequest({
            path: `/api/dining/search/cheap${date != null ? `?date=${DateUtil.toDateString(date)}` : ''}`
        });

        if (!Array.isArray(response) || response.length === 0) {
            return [];
        }

        const serverResults = response as Array<IServerCheapItemSearchResult>;
        const results: Array<ICheapItemSearchResult> = [];

        for (const serverResult of serverResults) {
            results.push({
                name: serverResult.name,
                description: serverResult.description,
                imageUrl: serverResult.imageUrl,
                locationDatesByCafeId: DiningClient._deserializeLocationDatesByCafeId(serverResult.locations),
                price: serverResult.price,
                minCalories: serverResult.minCalories,
                maxCalories: serverResult.maxCalories,
            });
        }

        return results;
    }

    public static async retrieveWaitTimeForItems(cafeId: string, itemCount: number): Promise<IWaitTimeResponse> {
        const response = await makeJsonRequest({
            path: `/api/dining/order/wait/${cafeId}?items=${itemCount}`
        });

        if (!isDuckType<IWaitTimeResponse>(response, { minTime: 'number', maxTime: 'number' })) {
            throw new Error('Invalid response format: missing min/maxTime or in wrong format');
        }

        return response;
    }

    public static async retrieveVisitHistory(entityType: SearchEntityType, name: string, date?: Date): Promise<Array<IEntityVisitData>> {
        const response = await makeJsonRequest({
            path: `/api/dining/search/visit-history?type=${entityType}&name=${encodeURIComponent(name)}${date != null ? `&date=${DateUtil.toDateString(date)}` : ''}`
        });

        if (!isDuckTypeArray<IEntityVisitData>(response, { dateString: 'string', cafeId: 'string' })) {
            throw new Error('Invalid response format: missing dateString or cafeId or in wrong format');
        }

        return response;
    }

    public static async retrieveAuthenticatedUser(): Promise<IClientUser> {
        const user = await makeJsonRequest({
            path: `/api/auth/me`
        });

        if (!isDuckType<IClientUserDTO>(user, { id: 'string', displayName: 'string', provider: 'string', createdAt: 'number' })) {
            throw new Error('Invalid response format: missing email or displayName');
        }

        return {
            id: user.id,
            displayName: user.displayName,
            provider: user.provider,
            createdAt: new Date(user.createdAt)
        };
    }

    public static async updateMyDisplayName(displayName: string): Promise<void> {
        await makeJsonRequestNoParse({
            path: '/api/auth/me/name',
            options: {
                method: 'PATCH',
                body: JSON.stringify({ displayName })
            }
        });
    }

    private static _deserializeReviews(reviews: unknown): Array<IReview> {
        if (!isDuckTypeArray<IReview>(reviews, { id: 'string', userId: 'string', userDisplayName: 'string', rating: 'number', createdDate: 'string' })) {
            throw new Error('Invalid response format: missing reviews or in wrong format');
        }

        return reviews;
    }

    public static async retrieveReviewsForMenuItem(menuItemId: string): Promise<IReviewDataForMenuItem> {
        const response = await makeJsonRequest({
            path: `/api/dining/menu/menu-items/${menuItemId}/reviews`
        });

        if (!isDuckType<IReviewDataForMenuItem>(response, { overallRating: 'number', totalCount: 'number', counts: 'object', reviewsWithComments: 'object' })) {
            throw new Error('Reviews not in the correct format');
        }

        return response;
    }

    public static async retrieveMyReviews(): Promise<Array<IReview>> {
        const reviews = await makeJsonRequest({
            path: '/api/dining/menu/reviews/mine'
        });

        return DiningClient._deserializeReviews(reviews);
    }

    public static async updateSettings(settings: Omit<IUpdateUserSettingsInput, 'timestamp'>): Promise<void> {
        await makeJsonRequestNoParse({
            path: '/api/auth/me/settings',
            options: {
                method: 'PATCH',
                body: JSON.stringify({
                    ...settings,
                    timestamp: Date.now()
                })
            }
        });
    }

    public static async createReview(menuItemId: string, request: ICreateReviewRequest): Promise<string /*id*/> {
        if (request.comment?.trim().length === 0) {
            request.comment = undefined;
        }

        const response = await makeJsonRequest({
            path: `/api/dining/menu/menu-items/${menuItemId}/reviews`,
            options: {
                method: 'PUT',
                body: JSON.stringify(request)
            }
        });

        if (!isDuckType<{ id: string }>(response, { id: 'string' })) {
            throw new Error('Response is invalid or in the wrong format');
        }

        return response.id;
    }

    public static async deleteReview(reviewId: string): Promise<void> {
        await makeJsonRequestNoParse({
            path: `/api/dining/menu/reviews/${reviewId}`,
            options: {
                method: 'DELETE'
            }
        });
    }

    public static async getRecentReviews(): Promise<Array<IReview>> {
        const response = await makeJsonRequest({
            path: '/api/dining/menu/reviews/recent'
        });

        if (!isDuckTypeArray<IReview>(response, { id: 'string', menuItemId: 'string', menuItemName: 'string' })) {
            throw new Error('Invalid format');
        }

        return response;
    }

    public static async forceRefreshCafes(forceUseNextWeek: boolean = false): Promise<void> {
        await makeJsonRequestNoParse({
            path:    `/api/dev/refresh${forceUseNextWeek ? '?next=true' : ''}`,
            options: {
                method: 'POST'
            }
        });
    }
}
