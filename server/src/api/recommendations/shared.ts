import { CAFES_BY_ID } from '../../constants/cafes.js';
import { getNamespaceLogger } from '../../util/log.js';
import { ACCOMPANIMENT_FILTER } from '../../util/menu-item-filter.js';
import { IMenuItemCandidate } from '../../util/recommendation.js';
import { retrieveDailyCafeMenuAsync } from '../cache/daily-menu.js';
import { getShutDownCafeIdsAsync } from '../cache/daily-cafe-state.js';

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
	getAllMenuItems: () => Promise<Array<IMenuItemCandidate>>;
}

export interface IUserRecommendationContext {
	userId: string;
	dateString: string;
	getAllMenuItems: () => Promise<Array<IMenuItemCandidate>>;
	seed: string;
}

const getCafeIds = async (dateString: string, cafeId?: string): Promise<string[]> => {
	const shutDownCafeIds = await getShutDownCafeIdsAsync(dateString);
	const cafeIds = cafeId ? [cafeId] : Array.from(CAFES_BY_ID.keys());
	return cafeIds.filter(cafeId => !shutDownCafeIds.has(cafeId));
}

export const getAllAvailableItems = async (dateString: string, cafeId?: string): Promise<IMenuItemCandidate[]> => {
    const items: IMenuItemCandidate[] = [];
	const cafeIds = await getCafeIds(dateString, cafeId);

	await Promise.all(cafeIds.map(async (cafeId) => {
		const cafe = CAFES_BY_ID.get(cafeId);
		if (!cafe) {
			return;
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
	}));

    return items;
};
