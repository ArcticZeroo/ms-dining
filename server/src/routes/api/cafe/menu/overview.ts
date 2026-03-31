import Router from '@koa/router';
import { ICafe } from '../../../../models/cafe.js';
import { ICafeOverviewResponse, ICafeOverviewStation } from '@msdining/common/models/cafe';
import { DailyMenuStorageClient } from '../../../../api/storage/clients/daily-menu.js';
import { retrieveUniquenessDataForCafe } from '../../../../api/cache/daily-uniqueness.js';
import { getDefaultUniquenessDataForStation } from '../../../../util/cafe.js';
import { IRecommendationItem } from '@msdining/common/models/recommendation';
import { getRecommendationsAsync } from '../../../../api/cache/recommendations.js';
import { sendVisitFromCafeParamMiddleware } from '../../../../middleware/analytics.js';
import { getApplicationNameForMenuOverview } from '@msdining/common/constants/analytics';
import { memoizeResponseBodyWithResetOnMenuUpdate } from '../../../../middleware/cache.js';
import { supportsVersionTag, validateViewMenuAccessAsync } from '../../../../util/koa.js';
import { VERSION_TAG } from '@msdining/common/constants/versions';
import { jsonStringifyWithoutNull } from '../../../../util/serde.js';
import { createSeededRandom, getUserSeededRandom, selectWithVariety } from '../../../../util/random.js';

export const registerOverviewRoutes = (router: Router) => {
	const retrieveAllOverviewStations = async (cafes: ICafe[], dateString: string): Promise<Map<string /*cafeId**/, Array<ICafeOverviewStation>>> => {
		const overviewStationsByCafeId = new Map<string, Array<ICafeOverviewStation>>();

		await Promise.all(
			cafes.map(async (cafe) => {
				const [stationHeaders, uniquenessData] = await Promise.all([
					DailyMenuStorageClient.retrieveDailyMenuOverviewHeadersAsync(cafe.id, dateString),
					retrieveUniquenessDataForCafe(cafe.id, dateString)
				]);

				const stations = stationHeaders.map(station => ({
					...station,
					uniqueness: uniquenessData.get(station.name) ?? getDefaultUniquenessDataForStation()
				}));

				overviewStationsByCafeId.set(cafe.id, stations);
			})
		);

		return overviewStationsByCafeId;
	}

	const retrieveFeaturedItemsForOverviewAsync = async (isSupported: boolean, cafeIds: string[], dateString: string): Promise<Array<IRecommendationItem>> => {
		if (!isSupported) {
			return [];
		}

		const recommendations = await getRecommendationsAsync({
			dateString,
			cafeIdFilter:      new Set(cafeIds),
			userId:            null,
			homepageIds:       cafeIds,
			favoriteItemNames: []
		});

		const sortedRecommendations = recommendations
			.flatMap(section => section.items)
			.sort((a, b) => b.score - a.score);

		const random = createSeededRandom(dateString);
		return selectWithVariety(sortedRecommendations, 10, random)
	}

	router.get('/:id/overview',
		sendVisitFromCafeParamMiddleware(getApplicationNameForMenuOverview),
		memoizeResponseBodyWithResetOnMenuUpdate({ isPublic: true }),
		async ctx => validateViewMenuAccessAsync(ctx, async (cafes, dateString) => {
			const cafeIds = cafes.map(cafe => cafe.id);

			const supportsFeaturedInOverview = supportsVersionTag(ctx, VERSION_TAG.featuredInOverview);

			const [
				recommendations,
				overviewStations
			] = await Promise.all([
				retrieveFeaturedItemsForOverviewAsync(supportsFeaturedInOverview, cafeIds, dateString),
				retrieveAllOverviewStations(cafes, dateString)
			]);

			if (!supportsFeaturedInOverview) {
				ctx.body = jsonStringifyWithoutNull(overviewStations);
				return;
			}

			const response: ICafeOverviewResponse = {
				stations: Object.fromEntries(overviewStations),
				featuredItems: recommendations
			};

			ctx.body = jsonStringifyWithoutNull(response);
		}));
}