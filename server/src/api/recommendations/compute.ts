import {
	IRecommendationItem,
	IRecommendationSection,
	RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { getEntityKey } from '@msdining/common/util/entity-key';
import { selectWithFilter } from '../../util/random.js';
import { ITEMS_PER_SECTION } from './shared.js';

const PROXIMITY_EXEMPT_SECTION_TYPES = new Set<RecommendationSectionType>([
    RecommendationSectionType.newAtFavorites,
    RecommendationSectionType.favorites,
]);

const applyProximityWeighting = (
    items: readonly IRecommendationItem[],
    sectionType: RecommendationSectionType,
    proximityWeights: Map<string, number> | null,
): IRecommendationItem[] => {
    if (!proximityWeights || PROXIMITY_EXEMPT_SECTION_TYPES.has(sectionType)) {
        return items as IRecommendationItem[];
    }

    const resultItems: IRecommendationItem[] = [];
    let isAnyWeightNotDefault = false;
    for (const item of items) {
        const weight = proximityWeights.get(item.cafeId) ?? 1;
        if (weight > 0) {
            resultItems.push({
                ...item,
                score: item.score * weight,
            });
        }

        if (weight !== 1) {
            isAnyWeightNotDefault = true;
        }
    }

    if (isAnyWeightNotDefault) {
        resultItems.sort((itemA, itemB) => itemB.score - itemA.score);
    }

    return resultItems;
};

// Sections are processed in this order. Higher-priority sections claim items first;
// lower-priority sections pick from the remaining pool.
const SECTION_PRIORITY: RecommendationSectionType[] = [
    RecommendationSectionType.newAtFavorites,
    RecommendationSectionType.basedOnReviews,
    RecommendationSectionType.popular,
    RecommendationSectionType.hiddenGems,
    RecommendationSectionType.trySomethingDifferent,
];

interface IAssembleSectionsParams {
    sectionsByType: Map<RecommendationSectionType, Array<IRecommendationItem>>;
    claimedKeys: Set<string>;
    proximityWeights: Map<string, number> | null;
    random: () => number;
}

/**
 * Assembles the final recommendation sections in priority order with dedup-aware selection.
 *
 * For user-specific sections (already fixed-size): filters out claimed entity keys.
 * For anonymous sections (full pools): applies proximity weighting, then uses selectWithFilter
 * to pick ITEMS_PER_SECTION items that aren't already claimed.
 *
 * Each section's selected items are added to the claimed set before processing the next section.
 */
export const assembleSections = ({
    sectionsByType,
    claimedKeys,
    proximityWeights,
    random,
}: IAssembleSectionsParams): IRecommendationSection[] => {
    const result: IRecommendationSection[] = [];
    const tryClaim = (item: IRecommendationItem) => {
		if (claimedKeys.has(getEntityKey(item))) {
			return false;
		}

		claimedKeys.add(getEntityKey(item));
		return true;
	}

    for (const sectionType of SECTION_PRIORITY) {
        const items = sectionsByType.get(sectionType);
        if (!items) {
            continue;
        }

        const adjustedItems = applyProximityWeighting(items, sectionType, proximityWeights);
        const selectedItems = selectWithFilter(adjustedItems, ITEMS_PER_SECTION, random, tryClaim);

        if (selectedItems.length === 0) {
            continue;
        }

        result.push({ type: sectionType, items: selectedItems });
    }

    return result;
};
