import Router from '@koa/router';
import { IMenuItemDTO, IStationUniquenessData } from '@msdining/common/dist/models/cafe.js';
import { MenuResponse } from '@msdining/common/dist/models/http.js';
import { ERROR_BODIES } from '@msdining/common/dist/responses.js';
import { isAnyCafeCurrentlyUpdating, isCafeCurrentlyUpdating } from '../../../api/cafe/cache/update.js';
import { CafeStorageClient } from '../../../api/storage/clients/cafe.js';
import { DailyMenuStorageClient } from '../../../api/storage/clients/daily-menu.js';
import { memoizeResponseBodyByQueryParams } from '../../../middleware/cache.js';
import { ICafe, ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { getBetterLogoUrl, getDefaultUniquenessDataForStation } from '../../../util/cafe.js';
import { getDateStringForMenuRequest } from '../../../util/date.js';
import { attachRouter } from '../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../util/serde.js';
import { sendAnonymousVisitFireAndForget, sendVisitFireAndForget } from '../../../api/tracking/visitors.js';
import { getApplicationNameForCafeMenu, getApplicationNameForMenuOverview } from '../../../constants/tracking.js';
import { randomUUID } from 'node:crypto';

const getUniquenessDataForStation = (station: ICafeStation, uniquenessData: Map<string, IStationUniquenessData> | null): IStationUniquenessData => {
    if (uniquenessData == null || !uniquenessData.has(station.name)) {
        return getDefaultUniquenessDataForStation(station.menuItemsById.size);
    }

    return uniquenessData.get(station.name)!;
};

export const registerMenuRoutes = (parent: Router) => {
    const router = new Router();

    const serializeMenuItem = (menuItem: IMenuItem): IMenuItemDTO => ({
        ...menuItem,
        tags:       Array.from(menuItem.tags),
        searchTags: Array.from(menuItem.searchTags)
    });

    const convertMenuToSerializable = (menuStations: ICafeStation[], uniquenessData: Map<string, IStationUniquenessData> | null): MenuResponse => {
        const menusByStation: MenuResponse = [];

        for (const station of menuStations) {
            const uniquenessDataForStation = getUniquenessDataForStation(station, uniquenessData);

            const itemsByCategory: Record<string, Array<IMenuItemDTO>> = {};

            for (const [categoryName, categoryItemIds] of station.menuItemIdsByCategoryName) {
                const itemsForCategory: IMenuItemDTO[] = [];

                for (const itemId of categoryItemIds) {
                    // Expected; Some items are 86-ed
                    if (!station.menuItemsById.has(itemId)) {
                        continue;
                    }

                    itemsForCategory.push(serializeMenuItem(station.menuItemsById.get(itemId)!));
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
    };

    const validateCafeAsync = async (ctx: Router.RouterContext, onReady: (cafe: ICafe, dateString: string) => Promise<void>) => {
        const id = ctx.params.id?.toLowerCase();
        if (!id) {
            ctx.throw(400, 'Missing cafe id');
        }

        const dateString = getDateStringForMenuRequest(ctx);
        if (dateString == null) {
            ctx.body = JSON.stringify([]);
            return;
        }

        const cafe = await CafeStorageClient.retrieveCafeAsync(id);
        if (!cafe) {
            ctx.throw(404, 'Cafe not found or data is missing');
        }

        if (isCafeCurrentlyUpdating(dateString, cafe)) {
            ctx.status = 503;
            ctx.body = ERROR_BODIES.menusCurrentlyUpdating;
            return;
        }

        return onReady(cafe, dateString);
    };

    router.get('/menu/:id',
        memoizeResponseBodyByQueryParams(),
        async ctx => validateCafeAsync(ctx, async (cafe, dateString) => {
            sendAnonymousVisitFireAndForget(getApplicationNameForCafeMenu(cafe.id));

            const menuStations = await DailyMenuStorageClient.retrieveDailyMenuAsync(cafe.id, dateString);

            let uniquenessData: Map<string, IStationUniquenessData> | null = null;
            if (!isAnyCafeCurrentlyUpdating() && menuStations.length > 0) {
                uniquenessData = await DailyMenuStorageClient.retrieveUniquenessDataForCafe(cafe.id, dateString);
            }

            ctx.body = jsonStringifyWithoutNull(convertMenuToSerializable(menuStations, uniquenessData));
        }));

    router.get('/menu/:id/overview',
        memoizeResponseBodyByQueryParams(),
        async ctx => validateCafeAsync(ctx, async (cafe, dateString) => {
            sendAnonymousVisitFireAndForget(getApplicationNameForMenuOverview(cafe.id));

            const overviewStations = await DailyMenuStorageClient.retrieveDailyMenuOverviewAsync(cafe.id, dateString);
            ctx.body = jsonStringifyWithoutNull(overviewStations);
        }));

    attachRouter(parent, router);
};