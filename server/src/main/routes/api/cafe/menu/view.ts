import Router, { RouterMiddleware } from '@koa/router';
import { IMenuItemDTO, IMenuOverviewSummary, IStationUniquenessData } from '@msdining/common/models/cafe';
import { ICafeMenuResponse, MenuResponse } from '@msdining/common/models/http';
import { memoizeResponseBodyWithResetOnMenuUpdate } from '../../../../middleware/cache.js';
import { menuEtagMiddleware } from '../../../../middleware/menu-etag.js';
import { ICafeStation, IMenuItemBase } from '../../../../../shared/models/cafe.js';
import {
    getDefaultUniquenessDataForStation,
    getStationLogoUrl,
    resolveViewToCafes
} from '../../../../../shared/util/cafe.js';
import { getDateStringForMenuRequest } from '../../../../util/date.js';
import { attachRouter, supportsVersionTag, validateCafeMenuAccessAsync } from '../../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../../../shared/util/serde.js';
import {
    getApplicationNameForCafeMenu,
    getApplicationNameForMenuOverviewSummary,
} from '@msdining/common/constants/analytics';
import { sendVisitFromCafeParamMiddleware } from '../../../../middleware/analytics.js';
import { logDebug } from '../../../../../shared/util/log.js';
import { ensureThumbnailDataHasBeenRetrievedAsync } from '../../../../../worker/interface/thumbnail.js';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { setTelemetryProperties } from '../../../../middleware/telemetry.js';
import { registerOverviewRoutes } from './overview.js';
import { VERSION_TAG } from '@msdining/common/constants/versions';
import { getServices } from '../../../../../shared/services/registry.js';

const getUniquenessDataForStation = (station: ICafeStation, uniquenessData: Record<string, IStationUniquenessData> | null): IStationUniquenessData => {
    const stationUniquenessData = uniquenessData?.[station.name];
    if (stationUniquenessData == null) {
        return getDefaultUniquenessDataForStation(station.menuItemsById.size);
    }

    return stationUniquenessData;
};

export const registerViewRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/:id'
    });

    router.use(async (ctx, next) => {
        setTelemetryProperties(ctx, { viewId: ctx.params.id ?? '' });
        await next();
    });

    const serializeMenuItem = async (menuItem: IMenuItemBase): Promise<IMenuItemDTO> => {
        const [reviewHeader, firstAppearance] = await Promise.all([
            getServices().data.review.retrieveReviewHeader({ menuItem }),
            getServices().data.menuItem.retrieveFirstMenuItemAppearance({ menuItemId: menuItem.id }),
            ensureThumbnailDataHasBeenRetrievedAsync(menuItem),
        ]);

        return ({
            ...reviewHeader,
            ...menuItem,
            firstAppearance,
            lastUpdateTime: menuItem.lastUpdateTime?.getTime(),
            tags:           Array.from(menuItem.tags),
            searchTags:     Array.from(menuItem.searchTags)
        });
    };

    const convertMenuToSerializable = async (menuStations: ICafeStation[], uniquenessData: Record<string, IStationUniquenessData> | null): Promise<MenuResponse> => {
        const menusByStation: MenuResponse = [];

        const addStation = async (station: ICafeStation): Promise<void> => {
            const uniquenessDataForStation = getUniquenessDataForStation(station, uniquenessData);

            const itemsByCategory: Record<string, Array<IMenuItemDTO>> = {};

            const serializeCategory = async (categoryName: string, categoryItemIds: string[]) => {
                const serializedItems: Array<Promise<IMenuItemDTO>> = [];

                for (const itemId of categoryItemIds) {
                    if (!station.menuItemsById.has(itemId)) {
                        logDebug(`Menu item with id ${itemId} not found in station ${station.name}. Skipping.`);
                        continue;
                    }

                    serializedItems.push(serializeMenuItem(station.menuItemsById.get(itemId)!));
                }

                itemsByCategory[categoryName] = await Promise.all(serializedItems);
            }

            const categoryPromises: Array<Promise<void>> = [];

            for (const [categoryName, categoryItemIds] of station.menuItemIdsByCategoryName) {
                categoryPromises.push(serializeCategory(categoryName, categoryItemIds));
            }

            await Promise.all(categoryPromises);

            if (Object.keys(itemsByCategory).length === 0) {
                return;
            }

            const stationReviewHeader = await getServices().data.review.retrieveStationReviewHeader({
                station: {
                    name: station.name,
                    groupId: station.groupId,
                }
            });

            menusByStation.push({
                id:               station.id,
                name:             station.name,
                logoUrl:          getStationLogoUrl(station.name, station.logoUrl),
                menu:             itemsByCategory,
                uniqueness:       uniquenessDataForStation,
                overallRating:    stationReviewHeader.totalReviewCount > 0 ? stationReviewHeader.overallRating : undefined,
                totalReviewCount: stationReviewHeader.totalReviewCount > 0 ? stationReviewHeader.totalReviewCount : undefined,
                opensAt:          station.opensAt,
                closesAt:         station.closesAt,
            });
        }

        const stationPromises: Array<Promise<void>> = [];

        for (const station of menuStations) {
            stationPromises.push(addStation(station));
        }

        await Promise.all(stationPromises);

        return menusByStation;
    };

    const handleMenuRequest = (allowArrayFallback: boolean): RouterMiddleware => async (ctx) => validateCafeMenuAccessAsync(ctx, async (cafe, dateString) => {
        const [menuStations, uniquenessData, dailyCafeState] = await Promise.all([
            getServices().data.dailyMenu.retrieveDailyCafeMenu({ cafeId: cafe.id, dateString }),
            getServices().data.menuAnalytics.retrieveUniquenessDataForCafe({ cafeId: cafe.id, targetDateString: dateString }),
            getServices().data.dailyMenu.retrieveDailyCafeStateAsync({ cafeId: cafe.id, dateString }),
        ]);

        if (allowArrayFallback && !supportsVersionTag(ctx, VERSION_TAG.menuRouteIsObjectInsteadOfArray)) {
            ctx.body = jsonStringifyWithoutNull(await convertMenuToSerializable(menuStations, uniquenessData));
            return;
        }

        const [stations, ingredientsMenu] = await Promise.all([
            convertMenuToSerializable(menuStations, uniquenessData),
            getServices().data.menuAnalytics.resolveIngredientsMenu({ cafeId: cafe.id, dateString, menuStations }),
        ]);

        const response: ICafeMenuResponse = {
            isAvailable:     dailyCafeState.isAvailable,
            shutdownState:   dailyCafeState.shutdownState,
            ingredientsMenu: ingredientsMenu ?? undefined,
            stations,
        };

        ctx.body = jsonStringifyWithoutNull(response);
    });

    const registerMenuRoute = (name: string, allowArrayFallback: boolean) => router.get(name,
        sendVisitFromCafeParamMiddleware(getApplicationNameForCafeMenu),
        menuEtagMiddleware,
        memoizeResponseBodyWithResetOnMenuUpdate({ isPublic: true }),
        handleMenuRequest(allowArrayFallback));

    registerMenuRoute('/', true /*allowArrayFallback*/);
    // I was dumb and for some reason created a second menu route that returned an object instead of an array,
    // but I should have just used a version tag instead to modify the existing route. So now we are going to
    // support both for a while (a few weeks), then we'll switch back to the original route once we think the
    // version tag is saturated.
    registerMenuRoute('/menu', false /*allowArrayFallback*/);

    router.get('/overview-summary',
        sendVisitFromCafeParamMiddleware(getApplicationNameForMenuOverviewSummary),
        menuEtagMiddleware,
        memoizeResponseBodyWithResetOnMenuUpdate({ isPublic: true }),
        async ctx => {
            const id = ctx.params.id?.toLowerCase();
            if (!id) {
                return ctx.throw(400, 'Missing id');
            }

            const cafes = resolveViewToCafes(id);
            if (!cafes) {
                return ctx.throw(404, 'View not found');
            }

            const dateString = getDateStringForMenuRequest(ctx);
            if (dateString == null) {
                ctx.body = JSON.stringify({
                    total:         0,
                    traveling:     0,
                    newStations:   0,
                    newItems:      0,
                    rotating:      0,
                    shutDownState: {}
                });
                return;
            }

            const [allOverviewStations, shutDownCafeState] = await Promise.all([
                Promise.all(
                    cafes.map(async (cafe) => {
                        const [stationHeaders, uniquenessData] = await Promise.all([
                            getServices().data.dailyMenu.retrieveDailyMenuOverviewHeadersAsync({ cafeId: cafe.id, dateString }),
                            getServices().data.menuAnalytics.retrieveUniquenessDataForCafe({ cafeId: cafe.id, targetDateString: dateString })
                        ]);

                        return stationHeaders.map(station => ({
                            uniqueness: uniquenessData[station.name] ?? getDefaultUniquenessDataForStation()
                        }));
                    })
                ),
                getServices().data.menuAnalytics.getShutdownCafeState({ dateString })
            ]);

            const stations = allOverviewStations.flat();

            const shutdownState: IMenuOverviewSummary['shutdownState'] = {};
            for (const cafe of cafes) {
                const state = shutDownCafeState[cafe.id];
                if (state) {
                    shutdownState[cafe.id] = state;
                }
            }

            const summary: IMenuOverviewSummary = {
                total:       stations.length,
                traveling:   0,
                newStations: 0,
                newItems:    0,
                rotating:    0,
                shutdownState
            };

            for (const { uniqueness } of stations) {
                if (uniqueness.isTraveling) {
                    summary.traveling++;
                }
                if (getIsRecentlyAvailable(uniqueness.firstAppearance)) {
                    summary.newStations++;
                }
                if (uniqueness.recentlyAvailableItemCount > 0) {
                    summary.newItems++;
                }
                if (uniqueness.theme != null) {
                    summary.rotating++;
                }
            }

            ctx.body = JSON.stringify(summary);
        });

    registerOverviewRoutes(router);

    attachRouter(parent, router);
};
