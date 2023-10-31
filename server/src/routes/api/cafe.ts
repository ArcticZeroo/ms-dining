import Router from '@koa/router';
import * as diningConfig from '../../constants/cafes.js';
import { attachRouter } from '../../util/koa.js';
import { sendVisitAsync } from '../../api/tracking/visitors.js';
import { ApplicationContext } from '../../constants/context.js';
import { fromDateString, getDateStringForMenuRequest, nativeDayOfWeek, toDateString } from '../../util/date.js';
import { CafeStorageClient } from '../../api/storage/cafe.js';
import { logInfo } from '../../util/log.js';
import { getLogoUrl } from '../../util/cafe.js';
import { clamp } from '../../util/math.js';

const visitorIdHeader = 'X-Visitor-Id';

export const registerDiningHallRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/dining'
    });

    router.get('/', async ctx => {
        const visitorId = ctx.get(visitorIdHeader);
        if (ApplicationContext.hasCreatedTrackingApplication && visitorId) {
            // Fire and forget, don't block the rest of the request
            sendVisitAsync(visitorId)
                .catch(err => console.log('Failed to send visit for visitor', visitorId, ', error:', err));
        }

        const responseCafes = [];

        const cafeDataById = await CafeStorageClient.retrieveCafesAsync();

        for (const cafe of diningConfig.cafeList) {
            const cafeData = cafeDataById.get(cafe.id);
            if (!cafeData) {
                console.warn('Missing cafe data for cafe id', cafeData.id);
                continue;
            }

            responseCafes.push({
                name:    cafe.name,
                id:      cafe.id,
                group:   cafe.groupId,
                logoUrl: getLogoUrl(cafe, cafeData),
            });
        }

        ctx.body = JSON.stringify({
            cafes:  responseCafes,
            groups: diningConfig.groupList
        });
    });

    router.get('/menu/:id', async ctx => {
        const id = ctx.params.id;
        if (!id) {
            ctx.status = 400;
            ctx.body = 'Missing cafe id';
            return;
        }

        const dateString = getDateStringForMenuRequest(ctx);
        if (dateString == null) {
            return [];
        }

        const menuStations = await CafeStorageClient.retrieveDailyMenuAsync(id, dateString);
        if (menuStations.length === 0) {
            ctx.body = [];
            return;
        }

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

        ctx.body = JSON.stringify(menusByStation);
    });

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
                const locationsDatesByCafeId = {};
                for (const [cafeId, dates] of searchResult.locationDatesByCafeId.entries()) {
                    locationsDatesByCafeId[cafeId] = Array.from(dates);
                }

                searchResults.push({
                    type:         searchResult.type,
                    name:         searchResult.name,
                    description:  searchResult.description,
                    imageUrl:     searchResult.imageUrl,
                    locations:    locationsDatesByCafeId,
                    matchReasons: Array.from(searchResult.matchReasons),
                });
            }
        }

        ctx.body = JSON.stringify(searchResults, (_, value) => value ?? undefined);
    });

    attachRouter(parent, router);
};