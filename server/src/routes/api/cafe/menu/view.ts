import Router from '@koa/router';
import { IMenuOverviewSummary, IStationUniquenessData } from '@msdining/common/models/cafe';
import { ICafeMenuResponse, MenuResponse } from '@msdining/common/models/http';
import { DailyMenuStorageClient } from '../../../../api/storage/clients/daily-menu.js';
import { memoizeResponseBodyWithResetOnMenuUpdate } from '../../../../middleware/cache.js';
import { ICafeStation, IMenuItemBase } from '../../../../models/cafe.js';
import { getDefaultUniquenessDataForStation, getStationLogoUrl, resolveViewToCafes } from '../../../../util/cafe.js';
import { getDateStringForMenuRequest } from '../../../../util/date.js';
import { attachRouter, validateCafeMenuAccessAsync } from '../../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../../util/serde.js';
import {
	getApplicationNameForCafeMenu,
	getApplicationNameForMenuOverviewSummary,
} from '@msdining/common/constants/analytics';
import { sendVisitFromCafeParamMiddleware } from '../../../../middleware/analytics.js';
import { IMenuItemDTO } from '@msdining/common/models/cafe';
import { logDebug } from '../../../../util/log.js';
import { retrieveReviewHeaderAsync, retrieveStationReviewHeaderAsync } from '../../../../api/cache/reviews.js';
import { retrieveFirstMenuItemAppearance } from '../../../../api/cache/menu-item-first-appearance.js';
import { ensureThumbnailDataHasBeenRetrievedAsync } from '../../../../worker/interface/thumbnail.js';
import { retrieveDailyCafeMenuAsync } from '../../../../api/cache/daily-menu.js';
import { retrieveUniquenessDataForCafe } from '../../../../api/cache/daily-uniqueness.js';
import { resolveIngredientsMenuAsync } from '../../../../api/cache/ingredients-menu.js';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { setTelemetryProperties } from '../../../../middleware/telemetry.js';
import { registerOverviewRoutes } from './overview.js';
import { getShutdownCafeStateAsync } from '../../../../api/cache/daily-cafe-state.js';

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

	router.get('/menu',
		sendVisitFromCafeParamMiddleware(getApplicationNameForCafeMenu),
		memoizeResponseBodyWithResetOnMenuUpdate({ isPublic: true }),
		async ctx => validateCafeMenuAccessAsync(ctx, async (cafe, dateString) => {
			const [menuStations, uniquenessData, dailyCafeState] = await Promise.all([
				retrieveDailyCafeMenuAsync(cafe.id, dateString),
				retrieveUniquenessDataForCafe(cafe.id, dateString),
				DailyMenuStorageClient.retrieveDailyCafeStateAsync(cafe.id, dateString),
			]);

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
		}));

	router.get('/',
		sendVisitFromCafeParamMiddleware(getApplicationNameForCafeMenu),
		memoizeResponseBodyWithResetOnMenuUpdate({ isPublic: true }),
		async ctx => validateCafeMenuAccessAsync(ctx, async (cafe, dateString) => {
			const [menuStations, uniquenessData] = await Promise.all([
				retrieveDailyCafeMenuAsync(cafe.id, dateString),
				retrieveUniquenessDataForCafe(cafe.id, dateString)
			]);

			ctx.body = jsonStringifyWithoutNull(await convertMenuToSerializable(menuStations, uniquenessData));
		}));

	router.get('/overview-summary',
		sendVisitFromCafeParamMiddleware(getApplicationNameForMenuOverviewSummary),
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
							DailyMenuStorageClient.retrieveDailyMenuOverviewHeadersAsync(cafe.id, dateString),
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
				const state = shutDownCafeState.get(cafe.id);
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
