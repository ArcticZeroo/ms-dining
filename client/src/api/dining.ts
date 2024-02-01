import { DateUtil, SearchTypes } from '@msdining/common';
import { IDiningCoreResponse, IWaitTimeResponse } from '@msdining/common/dist/models/http';
import { ISearchQuery } from '@msdining/common/dist/models/search';
import { CafeMenu, CafeView, ICafe, ICafeStation, IMenuItem } from '../models/cafe.ts';
import {
    ICheapItemSearchResult,
    IQuerySearchResult,
    IServerCheapItemSearchResult,
    IServerSearchResult
} from '../models/search.ts';
import { ICancellationToken, pause } from '../util/async.ts';
import { expandAndFlattenView } from '../util/view';
import { FavoritesCache } from './cache/favorites.ts';
import { makeRequest } from './request.ts';
import { ApplicationSettings } from './settings.ts';
import { isDuckType } from '@arcticzeroo/typeguard';

const TIME_BETWEEN_BACKGROUND_MENU_REQUESTS_MS = 1000;
const FIRST_WEEKLY_MENUS_TIME = DateUtil.fromDateString('2023-10-31').getTime();

const JSON_HEADERS = {
    'Content-Type': 'application/json'
};

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
        return makeRequest({ path: '/api/dining/' });
    }

    public static retrieveViewList(): Promise<IDiningCoreResponse> {
        if (!DiningClient._viewListPromise) {
            DiningClient._viewListPromise = DiningClient._retrieveViewListInner();
        }

        return DiningClient._viewListPromise;
    }

    private static _retrieveCafeMenuInner(id: string, dateString: string): Promise<Array<ICafeStation>> {
        return makeRequest({
            path: `/api/dining/menu/${id}?date=${dateString}`
        });
    }

    private static _addToLastUsedCafeIds(id: string) {
        // Most recently used IDs are at the end of the list.
        ApplicationSettings.lastUsedCafeIds.value = [
            ...ApplicationSettings.lastUsedCafeIds.value.filter(existingId => existingId !== id),
            id
        ];
    }

    public static getMinimumDateForMenu(): Date {
        const now = new Date();
        const currentDayOfWeek = now.getDay();

        let daysSinceMonday = currentDayOfWeek - DateUtil.nativeDayOfWeek.Monday;
        if (daysSinceMonday <= 0) {
            daysSinceMonday += 7;
        }

        now.setDate(now.getDate() - daysSinceMonday);

        // Clone to avoid problems with modifying it down the line
        const firstWeeklyMenusDate = new Date(FIRST_WEEKLY_MENUS_TIME);
        if (DateUtil.isDateBefore(now, firstWeeklyMenusDate)) {
            return firstWeeklyMenusDate;
        }

        return now;
    }

    public static getMaximumDateForMenu(): Date {
        const now = new Date();
        const currentDayOfWeek = now.getDay();

        let daysUntilFriday = DateUtil.nativeDayOfWeek.Friday - currentDayOfWeek;
        if (daysUntilFriday <= 0) {
            daysUntilFriday += 7;
        }

        now.setDate(now.getDate() + daysUntilFriday);

        return now;
    }

    public static ensureDateIsNotWeekendForMenu(date: Date): Date {
        const dayOfWeek = date.getDay();

        if ([DateUtil.nativeDayOfWeek.Saturday, DateUtil.nativeDayOfWeek.Sunday].includes(dayOfWeek)) {
            let daysUntilMonday = DateUtil.nativeDayOfWeek.Monday - dayOfWeek;
            if (daysUntilMonday <= 0) {
                daysUntilMonday += 7;
            }

            date.setDate(date.getDate() + daysUntilMonday);
        }

        return date;
    }

    public static getTodayDateForMenu() {
        return DiningClient.ensureDateIsNotWeekendForMenu(new Date());
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
            DiningClient._cafeMenusByIdPerDateString.delete(id);
            throw err;
        }
    }

    public static getCafePriorityOrder(cafes: ICafe[], viewsById: Map<string, CafeView>) {
        const homepageViewIds = ApplicationSettings.homepageViews.value;
        const homepageCafeIds = new Set(
            Array.from(homepageViewIds)
                .filter(viewId => viewsById.has(viewId))
                .flatMap(viewId => expandAndFlattenView(viewId, viewsById))
                .map(cafe => cafe.id)
        );

        const lastUsedCafeIds = ApplicationSettings.lastUsedCafeIds.value;

        return cafes.sort((a, b) => {
            const aIndex = lastUsedCafeIds.indexOf(a.id);
            const bIndex = lastUsedCafeIds.indexOf(b.id);
            const isAHomepage = homepageCafeIds.has(a.id);
            const isBHomepage = homepageCafeIds.has(b.id);

            if (isAHomepage && !isBHomepage) {
                return -1;
            }

            if (!isAHomepage && isBHomepage) {
                return 1;
            }

            if (aIndex === -1 && bIndex === -1) {
                return 0;
            }

            if (aIndex === -1) {
                return 1;
            }

            if (bIndex === -1) {
                return -1;
            }

            return bIndex - aIndex;
        });
    }

    public static async retrieveRecentMenusInOrder(cafes: ICafe[], viewsById: Map<string, CafeView>, cancellationToken?: ICancellationToken) {
        console.log('Retrieving cafe menus...');
        const priorityOrder = DiningClient.getCafePriorityOrder(cafes, viewsById);

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
                matchReasons:          new Set(serverResult.matchReasons),
                prices:                new Set(serverResult.prices),
            });
        }

        return results;
    }

    public static async retrieveSearchResults(query: string): Promise<Array<IQuerySearchResult>> {
        const response = await makeRequest({
            path: `/api/dining/search?q=${encodeURIComponent(query)}`
        });

        return DiningClient._deserializeSearchResults(response);
    }

    public static async retrieveFavoriteSearchResults(queries: Array<SearchTypes.ISearchQuery>): Promise<Array<IQuerySearchResult>> {
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

        const response = await makeRequest({
            path:    `/api/dining/search/favorites`,
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

    public static async retrieveCheapItems(): Promise<Array<ICheapItemSearchResult>> {
        const response = await makeRequest({
            path: `/api/dining/search/cheap`
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
        const response = await makeRequest({
            path:    `/api/dining/order/wait/${cafeId}?items=${itemCount}`
        });

        if (!isDuckType<IWaitTimeResponse>(response, { minTime: 'number', maxTime: 'number' })) {
            throw new Error('Invalid response format: missing min/maxTime or in wrong format');
        }

        return response;
    }
}
