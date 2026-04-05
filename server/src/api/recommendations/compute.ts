import {
	IRecommendationItem,
	IRecommendationSection,
	RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { SearchEntityType } from '@msdining/common/models/search';
import { getEntityKey } from '@msdining/common/util/entity-key';
import { sortByEmbeddingDiversity } from '../storage/vector/client.js';
import { ITEMS_PER_SECTION } from './shared.js';

const VARIETY_POOL_MULTIPLIER = 3;

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

/**
 * Selects items from a pre-sorted pool using MMR (Maximal Marginal Relevance) ordering
 * to balance relevance with embedding-based diversity. Falls back to score-only ordering
 * for items without embeddings.
 *
 * Replaces selectWithFilter: instead of random shuffling within the pool,
 * items are ordered by diversity (via the worker thread) so selections span the embedding space.
 */
const selectWithEmbeddingDiversity = async (
    sortedItems: readonly IRecommendationItem[],
    count: number,
    lambda: number,
    seed: string,
    filter: (item: IRecommendationItem) => boolean,
): Promise<IRecommendationItem[]> => {
    if (sortedItems.length === 0) {
        return [];
    }

    const poolSize = Math.min(sortedItems.length, count * VARIETY_POOL_MULTIPLIER);
    const pool = sortedItems.slice(0, poolSize);

    const diverseOrder = await sortByEmbeddingDiversity(
        pool.map(item => item.menuItemId),
        SearchEntityType.menuItem,
        pool.map(item => item.score),
        lambda,
        seed,
    );

    const idToItem = new Map(pool.map(item => [item.menuItemId, item]));
    const selected: IRecommendationItem[] = [];
    for (const id of diverseOrder) {
        if (selected.length >= count) break;
        const item = idToItem.get(id);
        if (item && filter(item)) {
            selected.push(item);
        }
    }
    return selected;
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
    seed: string;
    lambda?: number;
}

/**
 * Assembles the final recommendation sections in priority order with dedup-aware selection.
 *
 * Uses MMR (Maximal Marginal Relevance) to select items that balance relevance with
 * embedding-based diversity. Each section's selected items are claimed before processing
 * the next section, preventing duplicates across sections.
 */
export const assembleSections = async ({
    sectionsByType,
    claimedKeys,
    proximityWeights,
    seed,
    lambda = 0.5,
}: IAssembleSectionsParams): Promise<IRecommendationSection[]> => {
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
        const selectedItems = await selectWithEmbeddingDiversity(
            adjustedItems,
            ITEMS_PER_SECTION,
            lambda,
            `${seed}:${sectionType}`,
            tryClaim,
        );

        if (selectedItems.length === 0) {
            continue;
        }

        result.push({ type: sectionType, items: selectedItems });
    }

    return result;
};
