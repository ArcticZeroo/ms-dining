import Router from '@koa/router';
import * as diningHallConfig from '../../constants/dining-halls.js';
import { attachRouter } from '../../util/koa.js';
import { diningHallSessionsByUrl } from '../../api/dining/cache.js';
import { sendVisitAsync } from '../../api/tracking/visitors.js';
import { ApplicationContext } from '../../constants/context.js';

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

        const responseDiningHalls = [];

        for (const diningHall of diningHallConfig.diningHalls) {
            const diningHallSession = diningHallSessionsByUrl.get(diningHall.url);

            if (diningHallSession == null) {
                continue;
            }

            responseDiningHalls.push({
                name:    diningHall.name,
                id:      diningHall.url,
                group:   diningHall.groupName,
                logoUrl: diningHallSession.logoUrl,
            });
        }

        ctx.body = JSON.stringify({
            diningHalls: responseDiningHalls,
            groups: diningHallConfig.groups
        });
    });

    router.get('/:id', async ctx => {
        const id = ctx.params.id;
        if (!id) {
            ctx.status = 400;
            ctx.body = 'Missing dining hall id';
            return;
        }

        const diningHallSession = diningHallSessionsByUrl.get(id);
        if (!diningHallSession) {
            ctx.status = 404;
            ctx.body = 'Dining hall not found or information is missing';
            return;
        }

        const menusByConcept = [];
        for (const concept of diningHallSession.concepts) {
            const itemsByCategory = {};

            for (const [categoryName, categoryItemIds] of concept.menuItemIdsByCategoryName) {
                const itemsForCategory = [];

                for (const itemId of categoryItemIds) {
                    // Expected; Some items are 86-ed
                    if (!concept.menuItemsById.has(itemId)) {
                        continue;
                    }

                    itemsForCategory.push(concept.menuItemsById.get(itemId));
                }

                if (itemsForCategory.length === 0) {
                    continue;
                }

                itemsByCategory[categoryName] = itemsForCategory;
            }

            if (Object.keys(itemsByCategory).length === 0) {
                continue;
            }

            menusByConcept.push({
                name:    concept.name,
                logoUrl: concept.logoUrl,
                menu:    itemsByCategory
            });
        }

        ctx.body = JSON.stringify(menusByConcept);
    });

    attachRouter(parent, router);
};