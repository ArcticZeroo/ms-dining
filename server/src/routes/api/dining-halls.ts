import Router from '@koa/router';
import { diningHalls } from '../../constants/dining-halls.js';
import { attachRouter } from '../../util/koa.js';
import { diningHallSessionsByUrl } from '../../api/dining/cache.js';

export const registerDiningHallRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/dining'
    });

    router.get('/', async ctx => {
        const responseDiningHalls = [];

        for (const diningHall of diningHalls) {
            const diningHallSession = diningHallSessionsByUrl.get(diningHall.url);

            if (diningHallSession == null) {
                continue;
            }

            responseDiningHalls.push({
                name:    diningHall.friendlyName,
                id:      diningHall.url,
                logoUrl: diningHallSession.logoUrl
            });
        }

        ctx.body = JSON.stringify(responseDiningHalls);
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