import Router from '@koa/router';
import { CafeStorageClient } from '../../../api/storage/clients/cafe.js';
import { DailyMenuStorageClient } from '../../../api/storage/clients/daily-menu.js';
import { requireMenusNotUpdating } from '../../../middleware/menu.js';
import { ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { AllMenusResponse, MenuResponse } from '../../../models/routes.js';
import { getBetterLogoUrl } from '../../../util/cafe.js';
import { getDateStringForMenuRequest } from '../../../util/date.js';
import { attachRouter } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
export const registerMenuRoutes = (parent: Router) => {
    const router = new Router();

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

    attachRouter(parent, router);
}