import { IRecommendationItem, IRecommendationSection } from '@msdining/common/models/recommendation';
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
	cafeIdFilter?: Set<string>;
	random: () => number;
	getAllMenuItems: () => Promise<IMenuItemCandidate[]>;
	getUserReviews: () => Promise<IServerReview[]>;
	getNewItemsForCafe: (cafeId: string) => Promise<IRecommendationItem[]>;
}

export const withErrorHandling = (name: string, promise: Promise<IRecommendationSection | null>) =>
    promise.catch(error => {
        log.error(`Error computing ${name}:`, error);
        return null;
    });

export const getAllAvailableItems = async (dateString: string, cafeIdFilter?: Set<string>): Promise<IMenuItemCandidate[]> => {
    const cafeIds = cafeIdFilter ? [...cafeIdFilter] : Array.from(CAFES_BY_ID.keys());
    const items: IMenuItemCandidate[] = [];

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
                    if (ACCOMPANIMENT_FILTER.matchesItemText(menuItem.name)) {
                        continue;
                    }
                    if (ACCOMPANIMENT_FILTER.matchesSearchTags(menuItem.searchTags)) {
                        continue;
                    }
                    items.push({ menuItem, cafeId, cafeName, stationName: station.name });
                }
            }
        }
    }

    return items;
};
