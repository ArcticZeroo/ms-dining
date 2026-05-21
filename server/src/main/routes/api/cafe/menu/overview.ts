import Router from '@koa/router';
import { ICafe } from '../../../../../shared/models/cafe.js';
import { ICafeOverviewResponse, ICafeOverviewStation } from '@msdining/common/models/cafe';
import { getServices } from '../../../../services/registry.js';
import { getDefaultUniquenessDataForStation } from '../../../../../shared/util/cafe.js';
import { IRecommendationItem, RecommendationSectionType } from '@msdining/common/models/recommendation';
import { sendVisitFromCafeParamMiddleware } from '../../../../middleware/analytics.js';
import { getApplicationNameForMenuOverview } from '@msdining/common/constants/analytics';
import { memoizeResponseBodyWithResetOnMenuUpdate } from '../../../../middleware/cache.js';
import { validateViewMenuAccessAsync } from '../../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../../../shared/util/serde.js';
import { createSeededRandom, selectWithVariety } from '../../../../../shared/util/random.js';
import { getDefaultReasonForSectionType } from '../../../../../shared/util/recommendation.js';

export const registerOverviewRoutes = (router: Router) => {
	const retrieveAllOverviewStations = async (cafes: ICafe[], dateString: string): Promise<Map<string /*cafeId**/, Array<ICafeOverviewStation>>> => {
		const overviewStationsByCafeId = new Map<string, Array<ICafeOverviewStation>>();

		await Promise.all(
			cafes.map(async (cafe) => {
				const [stationHeaders, uniquenessData] = await Promise.all([
					getServices().data.dailyMenu.retrieveDailyMenuOverviewHeadersAsync({ cafeId: cafe.id, dateString }),
					getServices().data.menuAnalytics.retrieveUniquenessDataForCafe({ cafeId: cafe.id, targetDateString: dateString })
				]);

				const stations = stationHeaders.map(station => ({
					...station,
					uniqueness: uniquenessData[station.name] ?? getDefaultUniquenessDataForStation()
				}));

				overviewStationsByCafeId.set(cafe.id, stations);
			})
		);

		return overviewStationsByCafeId;
	}

	const retrieveFeaturedItemsForOverviewAsync = async (cafeIds: string[], dateString: string): Promise<Array<IRecommendationItem>> => {
		const recommendations = await getServices().data.search.getRecommendations({
			dateString,
			cafeIdFilter:      cafeIds,
			homepageIds:       cafeIds,
			favoriteItemNames: []
		});

		const sortedRecommendations: Array<[IRecommendationItem, RecommendationSectionType]> = [];
		for (const recommendationSection of recommendations) {
			for (const item of recommendationSection.items) {
				sortedRecommendations.push([item, recommendationSection.type]);
			}
		}

		sortedRecommendations.sort(([itemA], [itemB]) => itemB.score - itemA.score);

		const random = createSeededRandom(dateString);
		const selectedRecommendations = selectWithVariety(sortedRecommendations, 10, random);

		const result: Array<IRecommendationItem> = [];
		for (const [item, sectionType] of selectedRecommendations) {
			const reason = item.reason || getDefaultReasonForSectionType(sectionType);
			result.push({
				...item,
				reason
			});
		}

		return result;
	}

	router.get('/overview',
		sendVisitFromCafeParamMiddleware(getApplicationNameForMenuOverview),
		memoizeResponseBodyWithResetOnMenuUpdate({ isPublic: true }),
		async ctx => validateViewMenuAccessAsync(ctx, async (cafes, dateString) => {
			const cafeIds = cafes.map(cafe => cafe.id);

			const [
				recommendations,
				overviewStations,
				shutdownCafeState
			] = await Promise.all([
				retrieveFeaturedItemsForOverviewAsync(cafeIds, dateString),
				retrieveAllOverviewStations(cafes, dateString),
				getServices().data.menuAnalytics.getShutdownCafeState({ dateString })
			]);

			const response: ICafeOverviewResponse = {
				stations:      Object.fromEntries(overviewStations),
				featuredItems: recommendations,
				shutdownState: shutdownCafeState
			};

			ctx.body = jsonStringifyWithoutNull(response);
		}));
}