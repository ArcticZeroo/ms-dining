import { IMenuItemReviewHeader } from '@msdining/common/models/cafe';
import {
	IRecommendationSection,
	RECOMMENDATION_SECTION_DISPLAY_NAMES,
	RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { getEntityKey } from '@msdining/common/util/entity-key';
import { computePopularityScore, IMenuItemCandidate, toRecommendationItem } from '../../../../util/recommendation.js';
import { retrieveReviewHeaderAsync } from '../../../cache/reviews.js';
import { IRecommendationContext } from '../../shared.js';

/**
 * "Popular Today" — ranks all available menu items by community review data and surfaces
 * the highest-scoring ones. Uses a popularity score that combines average rating with
 * review count (logarithmic scaling) so that well-reviewed items with more reviews rank
 * higher. Excludes items with zero reviews.
 *
 * Shown to all users (anonymous and authenticated). Results are cached at the anonymous
 * level, then per-user variety selection picks a subset.
 */
export const getPopularItems = async (
    context: IRecommendationContext,
): Promise<IRecommendationSection | null> => {
    const availableItems = await context.getAllMenuItems();

    const results = await Promise.allSettled(
        availableItems.map(async (item) => {
            const header = await retrieveReviewHeaderAsync(item.menuItem);
            return { item, header };
        })
    );

    const scored: Array<{ item: IMenuItemCandidate; score: number; header: IMenuItemReviewHeader }> = [];
    for (const result of results) {
        if (result.status !== 'fulfilled') {
            continue;
        }
        const { item, header } = result.value;
        if (header.totalReviewCount === 0) {
            continue;
        }
        scored.push({ item, score: computePopularityScore(header.overallRating, header.totalReviewCount), header });
    }

    scored.sort((a, b) => b.score - a.score);

    // Deduplicate by entity key — the same item can appear at multiple cafes with
    // identical review data, inflating the pool with duplicates and crowding out
    // other unique items. Keep the highest-scored (first) occurrence.
    const seenEntityKeys = new Set<string>();
    const uniqueScored = scored.filter(entry => {
        const key = getEntityKey(entry.item.menuItem);
        if (seenEntityKeys.has(key)) {
            return false;
        }
        seenEntityKeys.add(key);
        return true;
    });

    const items = uniqueScored
        .map(({ item, score, header }) => toRecommendationItem(item, score, undefined /*reason*/, header));

    if (items.length === 0) {
        return null;
    }

    return {
        type:  RecommendationSectionType.popular,
        title: RECOMMENDATION_SECTION_DISPLAY_NAMES[RecommendationSectionType.popular],
        items,
    };
};
