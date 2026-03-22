import {
	IRecommendationItem,
	IRecommendationSection,
	RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { getIsRecentlyAvailable } from '@msdining/common/util/date-util';
import { getEntityKey } from '@msdining/common/util/entity-key';
import { CAFES_BY_ID } from '../../../../constants/cafes.js';
import { IMenuItemCandidate, toRecommendationItem } from '../../../../util/recommendation.js';
import { retrieveDailyCafeMenuAsync } from '../../../cache/daily-menu.js';
import { retrieveUniquenessDataForCafe } from '../../../cache/daily-uniqueness.js';
import { retrieveFirstMenuItemAppearance } from '../../../cache/menu-item-first-appearance.js';
import { retrieveReviewHeaderAsync } from '../../../cache/reviews.js';
import { IRecommendationContext } from '../../shared.js';

interface INewAtFavoritesCandidate {
	item: IMenuItemCandidate;
	reason: string;
}

/**
 * "New at Your Favorites" — surfaces items that are new, rotating, or traveling at the user's
 * homepage cafes today. Helps users discover what's different about today's menu compared to
 * the usual offerings. Candidates include:
 * - Items at traveling stations (stations not present yesterday)
 * - Theme/rotating items (items unique to today, not present on adjacent days)
 * - Items appearing for the first time this week ("New this week")
 *
 * Only shown when the user has homepage cafes or a cafe filter.
 * Per-cafe results are cached; the user-facing section shuffles and deduplicates across cafes.
 */
export const getNewItemsForCafe = async (cafeId: string, dateString: string): Promise<IRecommendationItem[]> => {
    const cafe = CAFES_BY_ID.get(cafeId);
    if (!cafe) {
        return [];
    }

    const [stations, uniquenessData] = await Promise.all([
        retrieveDailyCafeMenuAsync(cafeId, dateString),
        retrieveUniquenessDataForCafe(cafeId, dateString),
    ]);

    // Collect candidates with reasons first, then batch header lookups
    const candidates: INewAtFavoritesCandidate[] = [];
    const seenEntityKeys = new Set<string>();

    for (const station of stations) {
        const uniqueness = uniquenessData.get(station.name);
        const themeItemIdSet = new Set(uniqueness?.themeItemIds ?? []);

        for (const menuItem of station.menuItemsById.values()) {
            const entityKey = getEntityKey(menuItem);
            if (seenEntityKeys.has(entityKey)) {
                continue;
            }

            let reason: string | undefined;

            if (uniqueness?.isTraveling) {
                reason = 'Traveling';
            } else if (themeItemIdSet.has(menuItem.id)) {
                reason = 'Rotating today';
            }

            if (!reason) {
                try {
                    const firstAppearance = await retrieveFirstMenuItemAppearance(menuItem.id);
                    if (getIsRecentlyAvailable(firstAppearance)) {
                        reason = 'New this week';
                    }
                } catch {
                    // Item might not have first appearance data yet
                }
            }

            if (!reason) {
                continue;
            }

            seenEntityKeys.add(entityKey);
            candidates.push({
                item: { menuItem, cafeId, cafeName: cafe.name, stationName: station.name },
                reason,
            });
        }
    }

    // Batch review header lookups
    const headerResults = await Promise.allSettled(
        candidates.map(({ item }) => retrieveReviewHeaderAsync(item.menuItem))
    );

    return candidates.map(({ item, reason }, index) => {
        const headerResult = headerResults[index]!;
        const header = headerResult.status === 'fulfilled' ? headerResult.value : null;
        return toRecommendationItem(item, 1, reason, header);
    });
};

export const getNewAtCafe = async (
    context: IRecommendationContext,
): Promise<IRecommendationSection | null> => {
	const newItemsForCafe = await getNewItemsForCafe(context.cafeId, context.dateString);

    const seenEntityKeys = new Set<string>();
    const items: IRecommendationItem[] = [];
	for (const item of newItemsForCafe) {
		const entityKey = getEntityKey(item);
		if (seenEntityKeys.has(entityKey)) {
			continue;
		}
		seenEntityKeys.add(entityKey);
		items.push(item);
	}

    if (items.length === 0) {
        return null;
    }

    return {
        type:  RecommendationSectionType.newAtFavorites,
        items
    };
};
