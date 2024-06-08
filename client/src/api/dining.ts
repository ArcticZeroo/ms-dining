import { isDuckType } from '@arcticzeroo/typeguard';
import { DateUtil, SearchTypes } from '@msdining/common';
import { IMenuItem } from '@msdining/common/dist/models/cafe';
import { IDiningCoreResponse, IWaitTimeResponse, MenuResponse } from '@msdining/common/dist/models/http';
import { ISearchQuery } from '@msdining/common/dist/models/search';
import { InternalSettings } from '../constants/settings.ts';
import { CafeMenu, CafeView, ICafe, ICafeStation } from '../models/cafe.ts';
import {
    ICheapItemSearchResult,
    IQuerySearchResult,
    IServerCheapItemSearchResult,
    IServerSearchResult
} from '../models/search.ts';
import { ICancellationToken, pause } from '../util/async.ts';
import { sortCafesInPriorityOrder } from '../util/sorting.ts';
import { FavoritesCache } from './cache/favorites.ts';
import { JSON_HEADERS, makeJsonRequest } from './request.ts';

const TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS = 1000;

interface IRetrieveCafeMenuParams {
    id: string;
    date?: Date;
    shouldCountTowardsLastUsed?: boolean;
}

export abstract class DiningClient {
    private static _viewListPromise: Promise<IDiningCoreResponse> | undefined = undefined;
    private static readonly _cafeMenusByIdPerDateString: Map<string, Map<string, Promise<CafeMenu>>> = new Map();
    private static readonly _favoritesCache = new FavoritesCache();

    private static async _retrieveViewListInner(): Promise<IDiningCoreResponse> {
        return makeJsonRequest({ path: '/api/dining/' });
    }

    public static retrieveViewList(): Promise<IDiningCoreResponse> {
        if (!DiningClient._viewListPromise) {
            DiningClient._viewListPromise = DiningClient._retrieveViewListInner();
        }

        return DiningClient._viewListPromise;
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
                    tags:       new Set(dto.tags),
                    searchTags: new Set(dto.searchTags)
                }));
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

    public static async retrieveRecentMenusInOrder(cafes: ICafe[], viewsById: Map<string, CafeView>, cancellationToken?: ICancellationToken) {
        console.log('Retrieving cafe menus...');
        const priorityOrder = sortCafesInPriorityOrder(cafes, viewsById);

        for (const cafe of priorityOrder.slice(0, 5)) {
            await pause(TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS);

            if (cancellationToken?.isCancelled) {
                break;
            }

            await DiningClient.retrieveCafeMenu({
                id:                         cafe.id,
                shouldCountTowardsLastUsed: false
            });
        }
    }

    public static getThumbnailUrlForMenuItem(menuItem: IMenuItem) {
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

    private static _deserializeSearchResults(response: unknown) {
        if (!Array.isArray(response) || response.length === 0) {
            return [];
        }

        const serverResults = response as Array<IServerSearchResult>;
        const results: Array<IQuerySearchResult> = [];

        for (const serverResult of serverResults) {
            results.push({
                entityType:            serverResult.type === 'menuItem'
                    ? SearchTypes.SearchEntityType.menuItem
                    : SearchTypes.SearchEntityType.station,
                name:                  serverResult.name,
                description:           serverResult.description,
                imageUrl:              serverResult.imageUrl,
                locationDatesByCafeId: DiningClient._deserializeLocationDatesByCafeId(serverResult.locations),
                pricesByCafeId:        new Map(Object.entries(serverResult.prices)),
                matchReasons:          new Set(serverResult.matchReasons),
                tags:                  serverResult.tags ? new Set(serverResult.tags) : undefined,
                searchTags:            serverResult.searchTags ? new Set(serverResult.searchTags) : undefined
            });
        }

        return results;
    }

    public static async retrieveSearchResults(query: string, date?: Date, isExact: boolean = false): Promise<Array<IQuerySearchResult>> {
        const searchParams = new URLSearchParams();

        searchParams.set('q', query);

        if (isExact) {
            searchParams.set('e', 'true');
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
            path:    `/api/dining/search/favorites${date != null ? `?date=${DateUtil.toDateString(date)}` : ''}`,
            options: {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify(remoteQueries)
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
                name:                  serverResult.name,
                description:           serverResult.description,
                imageUrl:              serverResult.imageUrl,
                locationDatesByCafeId: DiningClient._deserializeLocationDatesByCafeId(serverResult.locations),
                price:                 serverResult.price,
                minCalories:           serverResult.minCalories,
                maxCalories:           serverResult.maxCalories,
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
}
