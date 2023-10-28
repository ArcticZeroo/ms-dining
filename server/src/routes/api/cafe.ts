import Router from '@koa/router';
import * as diningConfig from '../../constants/cafes.js';
import { attachRouter } from '../../util/koa.js';
import { sendVisitAsync } from '../../api/tracking/visitors.js';
import { ApplicationContext } from '../../constants/context.js';
import { toDateString } from '../../util/date.js';
import { cachedCafeLogosById } from '../../api/storage/cafe.js';

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

        const cafeLogosById = await cachedCafeLogosById.retrieve();

        for (const cafe of diningConfig.cafeList) {
            responseCafes.push({
                name:    cafe.name,
                id:      cafe.id,
                group:   cafe.groupId,
                logoUrl: cafeLogosById.get(cafe.id),
            });
        }

        ctx.body = JSON.stringify({
            cafes:  responseCafes,
            groups: diningConfig.groupList
        });
    });

    router.get('/:id', async ctx => {
        const id = ctx.params.id;
        if (!id) {
            ctx.status = 400;
            ctx.body = 'Missing cafe id';
            return;
        }

        const nowDateString = toDateString(new Date());

        const cafeSession = cafeSessionsByUrl.get(id);
        if (!cafeSession) {
            ctx.status = 404;
            ctx.body = 'Cafe not found or information is missing';
            return;
        }

        const menusByStation = [];
        for (const station of cafeSession.stations) {
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

    attachRouter(parent, router);
};