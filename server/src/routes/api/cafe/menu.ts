import Router from '@koa/router';
import { IStationUniquenessData } from '@msdining/common/dist/models/cafe.js';
import { CafeStorageClient } from '../../../api/storage/clients/cafe.js';
import { DailyMenuStorageClient } from '../../../api/storage/clients/daily-menu.js';
import { ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { MenuResponse } from '../../../models/routes.js';
import { getBetterLogoUrl } from '../../../util/cafe.js';
import { getDateStringForMenuRequest } from '../../../util/date.js';
import { attachRouter } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import { memoizeResponseBodyByQueryParams } from '../../../middleware/cache.js';
import { isAnyCafeCurrentlyUpdating, isCafeCurrentlyUpdating } from '../../../api/cafe/cache/update.js';
import { ERROR_BODIES } from '@msdining/common/dist/responses.js';

const getDefaultUniquenessDataForStation = (station: ICafeStation): IStationUniquenessData => {
    return {
        daysThisWeek: 1,
        itemDays: {
            1: station.menuItemsById.size
        }
    };
}

const getUniquenessDataForStation = (station: ICafeStation, uniquenessData: Map<string, IStationUniquenessData> | null): IStationUniquenessData => {
    if (uniquenessData == null) {
        return getDefaultUniquenessDataForStation(station);
    }

    if (!uniquenessData.has(station.name)) {
        return getDefaultUniquenessDataForStation(station);
    }

    return uniquenessData.get(station.name)!;
}

export const registerMenuRoutes = (parent: Router) => {
    const router = new Router();

    const convertMenuToSerializable = (menuStations: ICafeStation[], uniquenessData: Map<string, IStationUniquenessData> | null): MenuResponse => {
        const menusByStation: MenuResponse = [];

        for (const station of menuStations) {
            const uniquenessDataForStation = getUniquenessDataForStation(station, uniquenessData);

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
                name:       station.name,
                logoUrl:    getBetterLogoUrl(station.name, station.logoUrl),
                menu:       itemsByCategory,
                uniqueness: uniquenessDataForStation
            });
        }

        return menusByStation;
    }

    router.get('/menu/:id',
        memoizeResponseBodyByQueryParams(),
        async ctx => {
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

            const cafe = await CafeStorageClient.retrieveCafeAsync(id);
            if (!cafe) {
                ctx.throw(404, 'Cafe not found or data is missing');
                return;
            }

            if (isCafeCurrentlyUpdating(dateString, cafe)) {
                ctx.status = 503;
                ctx.body = ERROR_BODIES.menusCurrentlyUpdating;
                return;
            }

            const menuStations = await DailyMenuStorageClient.retrieveDailyMenuAsync(id, dateString);

            let uniquenessData: Map<string, IStationUniquenessData> | null = null;
            if (!isAnyCafeCurrentlyUpdating() && menuStations.length > 0) {
                uniquenessData = await DailyMenuStorageClient.retrieveUniquenessDataForCafe(id, dateString);
            }

            ctx.body = jsonStringifyWithoutNull(convertMenuToSerializable(menuStations, uniquenessData));
        });

    attachRouter(parent, router);
}