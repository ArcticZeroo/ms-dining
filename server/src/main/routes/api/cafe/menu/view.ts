import Router from '@koa/router';
import { IMenuItemDTO, IMenuOverviewSummary, IStationUniquenessData } from '@msdining/common/models/cafe';
import { ICafeMenuResponse, MenuResponse } from '@msdining/common/models/http';
import { memoizeResponseBodyWithResetOnMenuUpdate } from '../../../../middleware/cache.js';
import { menuEtagMiddleware } from '../../../../middleware/menu-etag.js';
import { ICafeStation, IMenuItemBase } from '../../../../../shared/models/cafe.js';
import { getDefaultUniquenessDataForStation, getStationLogoUrl, resolveViewToCafes } from '../../../../../shared/util/cafe.js';
import { getDateStringForMenuRequest } from '../../../../util/date.js';
import { attachRouter, supportsVersionTag, validateCafeMenuAccessAsync } from '../../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../../../shared/util/serde.js';
import {
	getApplicationNameForCafeMenu,
	getApplicationNameForMenuOverviewSummary,
} from '@msdining/common/constants/analytics';
import { sendVisitFromCafeParamMiddleware } from '../../../../middleware/analytics.js';
import { logDebug } from '../../../../../shared/util/log.js';
import { retrieveReviewHeaderAsync, retrieveStationReviewHeaderAsync } from '../../../../../api/cache/reviews.js';
import { retrieveFirstMenuItemAppearance } from '../../../../../api/cache/menu-item-first-appearance.js';
import { ensureThumbnailDataHasBeenRetrievedAsync } from '../../../../../worker/interface/thumbnail.js';
import { retrieveDailyCafeMenuAsync } from '../../../../../api/cache/daily-menu.js';
import { retrieveUniquenessDataForCafe } from '../../../../../api/cache/daily-uniqueness.js';
import { resolveIngredientsMenuAsync } from '../../../../../api/cache/ingredients-menu.js';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { setTelemetryProperties } from '../../../../middleware/telemetry.js';
import { registerOverviewRoutes } from './overview.js';
import { getShutdownCafeStateAsync } from '../../../../../api/cache/daily-cafe-state.js';
import { VERSION_TAG } from '@msdining/common/constants/versions';
import { getServices } from '../../../../services/registry.js';

const getUniquenessDataForStation = (station: ICafeStation, uniquenessData: Map<string, IStationUniquenessData> | null): IStationUniquenessData => {
	if (uniquenessData == null || !uniquenessData.has(station.name)) {
		return getDefaultUniquenessDataForStation(station.menuItemsById.size);
	}

	return uniquenessData.get(station.name)!;
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
			retrieveReviewHeaderAsync(menuItem),
			retrieveFirstMenuItemAppearance(menuItem.id),
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

	const convertMenuToSerializable = async (menuStations: ICafeStation[], uniquenessData: Map<string, IStationUniquenessData> | null): Promise<MenuResponse> => {
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

			const stationReviewHeader = await retrieveStationReviewHeaderAsync({
				name:    station.name,
				groupId: station.groupId
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

	const handleMenuRequest = (allowArrayFallback: boolean): Router.Middleware => async (ctx) => validateCafeMenuAccessAsync(ctx, async (cafe, dateString) => {
		const [menuStations, uniquenessData, dailyCafeState] = await Promise.all([
			retrieveDailyCafeMenuAsync(cafe.id, dateString),
			retrieveUniquenessDataForCafe(cafe.id, dateString),
			getServices().data.dailyMenu.retrieveDailyCafeStateAsync({ cafeId: cafe.id, dateString }),
		]);

		if (allowArrayFallback && !supportsVersionTag(ctx, VERSION_TAG.menuRouteIsObjectInsteadOfArray)) {
			ctx.body = jsonStringifyWithoutNull(await convertMenuToSerializable(menuStations, uniquenessData));
			return;
		}

		const [stations, ingredientsMenu] = await Promise.all([
			convertMenuToSerializable(menuStations, uniquenessData),
			resolveIngredientsMenuAsync(cafe.id, dateString, menuStations),
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
							retrieveUniquenessDataForCafe(cafe.id, dateString)
						]);

						return stationHeaders.map(station => ({
							uniqueness: uniquenessData.get(station.name) ?? getDefaultUniquenessDataForStation()
						}));
					})
				),
				getShutdownCafeStateAsync(dateString)
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
