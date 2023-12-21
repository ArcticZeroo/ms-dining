import Router from '@koa/router';
import { isDateBefore } from '@msdining/common/dist/util/date-util.js';
import * as diningConfig from '../../constants/cafes.js';
import { attachRouter } from '../../util/koa.js';
import { sendVisitAsync } from '../../api/tracking/visitors.js';
import { ApplicationContext } from '../../constants/context.js';
import { getDateStringForMenuRequest, isCafeAvailable } from '../../util/date.js';
import { CafeStorageClient } from '../../api/storage/cafe.js';
import { getLogoUrl } from '../../util/cafe.js';
import { ICafeStation } from '../../models/cafe.js';
import { NumberUtil } from '@msdining/common';
import { jsonStringifyWithoutNull } from '../../util/serde.js';

const VISITOR_ID_HEADER = 'X-Visitor-Id';
const DEFAULT_MAX_PRICE = 9.99;
const DEFAULT_MIN_PRICE = 3;

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

        const cafeDataById = await CafeStorageClient.retrieveCafesAsync();

        const responseGroups = [];
        for (const group of diningConfig.groupList) {
            const responseGroup = {
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
                    logoUrl: getLogoUrl(cafe, cafeData),
                });
            }

            responseGroups.push(responseGroup);
        }

        ctx.body = jsonStringifyWithoutNull({
            groups: responseGroups
        });
    });

    const convertMenuToSerializable = (menuStations: ICafeStation[]) => {
        const menusByStation = [];
        for (const station of menuStations) {
            const itemsByCategory = {};

            for (const [categoryName, categoryItemIds] of station.menuItemIdsByCategoryName) {
                const itemsForCategory = [];

                for (const itemId of categoryItemIds) {
                    // Expected; Some items are 86-ed
                    if (!station.menuItemsById.has(itemId)) {
                        continue;
                    }

                    itemsForCategory.push(station.menuItemsById.get(itemId));
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
                logoUrl: station.logoUrl,
                menu:    itemsByCategory
            });
        }
        return menusByStation;
    }

    router.get('/menu/:id', async ctx => {
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
            const menusByCafeId = {};
            for (const cafeId of cafes.keys()) {
                const menuStations = await CafeStorageClient.retrieveDailyMenuAsync(cafeId, dateString);
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

        const menuStations = await CafeStorageClient.retrieveDailyMenuAsync(id, dateString);
        ctx.body = jsonStringifyWithoutNull(convertMenuToSerializable(menuStations));
    });

    const serializeLocationDatesByCafeId = (locationDatesByCafeId: Map<string, Set<string>>) => {
        const serialized = {};
        for (const [cafeId, dates] of locationDatesByCafeId.entries()) {
            serialized[cafeId] = Array.from(dates);
        }
        return serialized;
    }

    router.get('/search', async ctx => {
        const searchQuery = ctx.query.q;

        if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) {
            ctx.body = [];
            return;
        }

        const searchResultsByIdPerEntityType = await CafeStorageClient.search(searchQuery);
        const searchResults = [];
        for (const searchResultsById of searchResultsByIdPerEntityType.values()) {
            for (const searchResult of searchResultsById.values()) {
                searchResults.push({
                    type:         searchResult.type,
                    name:         searchResult.name,
                    description:  searchResult.description,
                    imageUrl:     searchResult.imageUrl,
                    locations:    serializeLocationDatesByCafeId(searchResult.locationDatesByCafeId),
                    matchReasons: Array.from(searchResult.matchReasons),
                });
            }
        }

        ctx.body = jsonStringifyWithoutNull(searchResults);
    });

    router.get('/search/cheap', async ctx => {
        const maxPriceRaw = ctx.query.max;
        const minPriceRaw = ctx.query.min;

        const maxPrice = typeof maxPriceRaw === 'string'
            ? NumberUtil.parseNumber(maxPriceRaw, DEFAULT_MAX_PRICE)
            : DEFAULT_MAX_PRICE;

        const minPrice = typeof minPriceRaw === 'string'
            ? NumberUtil.parseNumber(minPriceRaw, DEFAULT_MIN_PRICE)
            : DEFAULT_MIN_PRICE;

        const cheapItems = await CafeStorageClient.searchForCheapItems(
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