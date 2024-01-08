import Router from '@koa/router';
import * as diningConfig from '../../constants/cafes.js';
import { requireMenusNotUpdating } from '../../middleware/menu.js';
import { attachRouter, getTrimmedQueryParam } from '../../util/koa.js';
import { sendVisitAsync } from '../../api/tracking/visitors.js';
import { ApplicationContext } from '../../constants/context.js';
import { getDateStringForMenuRequest, isCafeAvailable } from '../../util/date.js';
import { getLogoUrl, getBetterLogoUrl } from '../../util/cafe.js';
import { ICafeStation, IMenuItem } from '../../models/cafe.js';
import { NumberUtil } from '@msdining/common';
import { jsonStringifyWithoutNull } from '../../util/serde.js';
import { CafeStorageClient } from '../../api/storage/clients/cafe.js';
import { DailyMenuStorageClient } from '../../api/storage/clients/daily-menu.js';
import { SearchManager } from '../../api/storage/search.js';
import { ISearchResult } from '../../models/search.js';
import Koa from 'koa';
import { ISearchQuery, SearchEntityType } from '@msdining/common/dist/models/search.js';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import { stat } from 'fs';
import {
    IDiningCoreGroup,
    IDiningCoreResponse,
    MenuResponse,
    IMenuResponseStation,
    AllMenusResponse
} from '../../models/routes.js';

const VISITOR_ID_HEADER = 'X-Visitor-Id';
const DEFAULT_MAX_PRICE = 15;
const DEFAULT_MIN_PRICE = 1;

export const registerDiningHallRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/dining'
    });

    router.get('/', async ctx => {
        const visitorId = ctx.get(VISITOR_ID_HEADER);
        if (ApplicationContext.hasCreatedTrackingApplication && visitorId) {
            // Fire and forget, don't block the rest of the request
            sendVisitAsync(visitorId)
                .catch(err => console.log('Failed to send visit for visitor', visitorId, ', error:', err));
        }

        const response: IDiningCoreResponse = {
            isTrackingEnabled: ApplicationContext.hasCreatedTrackingApplication,
            groups:            []
        };

        const cafeDataById = await CafeStorageClient.retrieveCafesAsync();

        for (const group of diningConfig.groupList) {
            const responseGroup: IDiningCoreGroup = {
                name:         group.name,
                id:           group.id,
                number:       group.number,
                alwaysExpand: group.alwaysExpand ?? false,
                members:      []
            };

            for (const cafe of group.members) {
                // Allows us to add cafes before they've officially opened, without polluting the menu list.
                // For instance, when Food Hall 4 was added, the online ordering menu became available more than
                // a week early.
                if (!isCafeAvailable(cafe)) {
                    continue;
                }

                const cafeData = cafeDataById.get(cafe.id);
                if (!cafeData) {
                    // Expected in case we have a cafe in config which isn't available online for some reason
                    continue;
                }

                responseGroup.members.push({
                    name:    cafe.name,
                    id:      cafe.id,
                    number:  cafe.number,
                    url:     cafe.url,
                    logoUrl: getLogoUrl(cafe, cafeData),
                });
            }

            response.groups.push(responseGroup);
        }

        ctx.body = jsonStringifyWithoutNull(response);
    });

    const convertMenuToSerializable = (menuStations: ICafeStation[]): MenuResponse => {
        const menusByStation: MenuResponse = [];
        for (const station of menuStations) {
            const itemsByCategory: Record<string, Array<IMenuItem>> = {};

            for (const [categoryName, categoryItemIds] of station.menuItemIdsByCategoryName) {
                const itemsForCategory: IMenuItem[] = [];

                for (const itemId of categoryItemIds) {
                    // Expected; Some items are 86-ed
                    if (!station.menuItemsById.has(itemId)) {
                        continue;
                    }

                    itemsForCategory.push(station.menuItemsById.get(itemId)!);
                }

                if (itemsForCategory.length === 0) {
                    continue;
                }

                itemsByCategory[categoryName] = itemsForCategory;
            }

            if (Object.keys(itemsByCategory).length === 0) {
                continue;
            }

            menusByStation.push({
                name:    station.name,
                logoUrl: getBetterLogoUrl(station.name, station.logoUrl),
                menu:    itemsByCategory
            });
        }
        return menusByStation;
    }

    router.get('/menu/:id', requireMenusNotUpdating, async ctx => {
        const id = ctx.params.id?.toLowerCase();
        if (!id) {
            ctx.throw(400, 'Missing cafe id');
            return;
        }

        const dateString = getDateStringForMenuRequest(ctx);
        if (dateString == null) {
            ctx.body = JSON.stringify([]);
            return;
        }

        if (id === 'all') {
            const cafes = await CafeStorageClient.retrieveCafesAsync();
            const menusByCafeId: AllMenusResponse = {};
            for (const cafeId of cafes.keys()) {
                const menuStations = await DailyMenuStorageClient.retrieveDailyMenuAsync(cafeId, dateString);
                menusByCafeId[cafeId] = convertMenuToSerializable(menuStations);
            }
            ctx.body = jsonStringifyWithoutNull(menusByCafeId);
            return;
        }

        const cafe = await CafeStorageClient.retrieveCafeAsync(id);
        if (!cafe) {
            ctx.throw(404, 'Cafe not found or data is missing');
            return;
        }

        const menuStations = await DailyMenuStorageClient.retrieveDailyMenuAsync(id, dateString);
        ctx.body = jsonStringifyWithoutNull(convertMenuToSerializable(menuStations));
    });

    const serializeLocationDatesByCafeId = (locationDatesByCafeId: Map<string, Set<string>>) => {
        const serialized: Record<string /*cafeId*/, Array<string>> = {};
        for (const [cafeId, dates] of locationDatesByCafeId.entries()) {
            serialized[cafeId] = Array.from(dates);
        }
        return serialized;
    }

    const serializeSearchResult = (searchResult: ISearchResult) => ({
        type:         searchResult.type,
        name:         searchResult.name,
        description:  searchResult.description,
        imageUrl:     getBetterLogoUrl(searchResult.name, searchResult.imageUrl),
        locations:    serializeLocationDatesByCafeId(searchResult.locationDatesByCafeId),
        matchReasons: Array.from(searchResult.matchReasons),
        prices:       Array.from(searchResult.prices),
    });

    const serializeSearchResults = (searchResultsByIdPerEntityType: Map<SearchEntityType, Map<string, ISearchResult>>) => {
        const searchResults = [];
        for (const searchResultsById of searchResultsByIdPerEntityType.values()) {
            for (const searchResult of searchResultsById.values()) {
                searchResults.push(serializeSearchResult(searchResult));
            }
        }
        return jsonStringifyWithoutNull(searchResults);
    }

    router.post('/search/favorites', requireMenusNotUpdating, async ctx => {
        const queries = ctx.request.body;

        if (!isDuckTypeArray<ISearchQuery>(queries, { text: 'string', type: 'string' })) {
            ctx.throw(400, 'Invalid request body');
            return;
        }

        const searchResultsByIdPerEntityType = await SearchManager.searchFavorites(queries);
        ctx.body = serializeSearchResults(searchResultsByIdPerEntityType);
    });

    router.get('/search', requireMenusNotUpdating, async ctx => {
        const searchQuery = getTrimmedQueryParam(ctx, 'q');

        if (!searchQuery) {
            ctx.body = [];
            return;
        }

        const searchResultsByIdPerEntityType = await SearchManager.search(searchQuery);
        ctx.body = serializeSearchResults(searchResultsByIdPerEntityType);
    });

    router.get('/search/cheap', requireMenusNotUpdating, async ctx => {
        const maxPriceRaw = ctx.query.max;
        const minPriceRaw = ctx.query.min;

        const maxPrice = typeof maxPriceRaw === 'string'
            ? NumberUtil.parseNumber(maxPriceRaw, DEFAULT_MAX_PRICE)
            : DEFAULT_MAX_PRICE;

        const minPrice = typeof minPriceRaw === 'string'
            ? NumberUtil.parseNumber(minPriceRaw, DEFAULT_MIN_PRICE)
            : DEFAULT_MIN_PRICE;

        const cheapItems = await SearchManager.searchForCheapItems(
            minPrice,
            maxPrice
        );

        const searchResults = [];
        for (const searchResult of cheapItems) {
            searchResults.push({
                name:        searchResult.name,
                description: searchResult.description,
                imageUrl:    searchResult.imageUrl,
                locations:   serializeLocationDatesByCafeId(searchResult.locationDatesByCafeId),
                price:       searchResult.price,
                minCalories: searchResult.minCalories,
                maxCalories: searchResult.maxCalories,
            });
        }

        ctx.body = jsonStringifyWithoutNull(searchResults);
    });

    attachRouter(parent, router);
};