import { IRecommendationItem, IRecommendationSection } from '@msdining/common/models/recommendation';
import { CAFES_BY_ID } from '../../constants/cafes.js';
import { IServerReview } from '../../models/review.js';
import { getNamespaceLogger } from '../../util/log.js';
import { IAvailableMenuItem } from '../../util/recommendation.js';
import { retrieveDailyCafeMenuAsync } from '../cache/daily-menu.js';

export const log = getNamespaceLogger('recommendations');

export const ITEMS_PER_SECTION = 8;
export const POSITIVE_REVIEW_THRESHOLD = 7;
export const NEGATIVE_REVIEW_THRESHOLD = 3;
export const VECTOR_SEARCH_LIMIT = 30;
export const HIDDEN_GEM_MAX_REVIEW_COUNT = 3;
export const TOP_RATED_SEED_COUNT = 5;

export interface IRecommendationContext {
	userId: string | null;
	dateString: string;
	homepageIds: string[];
	cafeIdFilter?: string;
	random: () => number;
	getAvailableItems: () => Promise<IAvailableMenuItem[]>;
	getUserReviews: () => Promise<IServerReview[]>;
	getNewItemsForCafe: (cafeId: string) => Promise<IRecommendationItem[]>;
}

export const withErrorHandling = (name: string, promise: Promise<IRecommendationSection | null>) =>
	promise.catch(error => {
		log.error(`Error computing ${name}:`, error);
		return null;
	});

export const getAllAvailableItems = async (dateString: string, cafeIdFilter?: string): Promise<IAvailableMenuItem[]> => {
	const cafeIds = cafeIdFilter ? [cafeIdFilter] : Array.from(CAFES_BY_ID.keys());
	const items: IAvailableMenuItem[] = [];

	const menus = await Promise.all(
		cafeIds.map(async (cafeId) => {
			const cafe = CAFES_BY_ID.get(cafeId);
			if (!cafe) {
				return [];
			}
			const stations = await retrieveDailyCafeMenuAsync(cafeId, dateString);
			return stations.map(station => ({ cafeId, cafeName: cafe.name, station }));
		})
	);

	for (const cafeMenus of menus) {
		for (const { cafeId, cafeName, station } of cafeMenus) {
			for (const menuItem of station.menuItemsById.values()) {
				items.push({ menuItem, cafeId, cafeName, stationName: station.name });
			}
		}
	}

	return items;
};
