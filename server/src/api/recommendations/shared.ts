import { IRecommendationSection } from '@msdining/common/models/recommendation';
import { CAFES_BY_ID } from '../../constants/cafes.js';
import { IServerReview } from '../../models/review.js';
import { getNamespaceLogger } from '../../util/log.js';
import { ACCOMPANIMENT_FILTER } from '../../util/menu-item-filter.js';
import { IMenuItemCandidate } from '../../util/recommendation.js';
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
	cafeId: string;
	getAllMenuItems: () => Promise<IMenuItemCandidate[]>;
	getUserReviews: () => Promise<IServerReview[]>;
	random: () => number;
}

export const getAllAvailableItems = async (dateString: string, cafeId: string): Promise<IMenuItemCandidate[]> => {
    const items: IMenuItemCandidate[] = [];

	const cafe = CAFES_BY_ID.get(cafeId);
	if (!cafe) {
		return [];
	}

	const stations = await retrieveDailyCafeMenuAsync(cafeId, dateString);
	for (const station of stations) {
		if (ACCOMPANIMENT_FILTER.matchesStationOrCategory(station.name)) {
			continue;
		}

		for (const [categoryName, itemIds] of station.menuItemIdsByCategoryName) {
			if (ACCOMPANIMENT_FILTER.matchesStationOrCategory(categoryName)) {
				continue;
			}

			for (const itemId of itemIds) {
				const menuItem = station.menuItemsById.get(itemId);
				if (!menuItem) {
					continue;
				}

				if (ACCOMPANIMENT_FILTER.matchesMenuItem(menuItem)) {
					continue;
				}

				items.push({ menuItem, cafeId, cafeName: cafe.name, stationName: station.name });
			}
		}
	}

    return items;
};
