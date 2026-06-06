import type { IMenuItemReviewHeader } from '@msdining/common/models/cafe';
import {
    IRecommendationItem,
    IRecommendationSection,
    RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { SearchEntityType } from '@msdining/common/models/search';
import { getOrderHistoryBoostMultiplier, getReviewPopularityMultiplier } from '@msdining/common/util/recommendation-ranking';
import { sortByEmbeddingDiversity } from '../storage/vector/client.js';
import { ITEMS_PER_SECTION } from './shared.js';

const VARIETY_POOL_MULTIPLIER = 3;

/**
 * Only `favorites` is fully exempt from weighting — items there are explicitly
 * user-curated, so any reordering on top of the user's own list would feel
 * arbitrary. `newAtFavorites` (rendered as "At Your Cafes") is intentionally
 * NOT exempt: it benefits from the order-history boost the same as the other
 * sections, and the drink/traveling-item itemWeights apply uniformly across
 * the homepage cafes the section already filters down to.
 */
const WEIGHTING_EXEMPT_SECTION_TYPES = new Set<RecommendationSectionType>([
    RecommendationSectionType.favorites,
]);

/**
 * Multiplier applied in the `trySomethingDifferent` section to items the
 * user has already personally interacted with (ordered or reviewed).
 * 0.1 ⇒ 10× demotion — strong enough that familiar items rarely surface
 * but they remain in the pool so a sparse pool doesn't end up empty.
 */
const TRY_SOMETHING_DIFFERENT_FAMILIAR_PENALTY = 0.1;

export interface IApplyWeightsOptions {
    proximityWeights: Map<string, number> | null;
    itemWeights: Map<string, number> | null;
    /** Per-entityKey count of past orders for the current user. */
    orderCountsByEntityKey?: Map<string /*entityKey*/, number> | null;
    /**
     * Set of entityKeys the user has personally interacted with (ordered or
     * reviewed). Used to demote items inside the `trySomethingDifferent`
     * section so the user is shown things they actually haven't tried.
     */
    familiarEntityKeys?: Set<string> | null;
    /**
     * Snapshot of the menu-item review header cache, keyed by entityKey.
     * When present, items with reviews are boosted/demoted via
     * {@link getReviewPopularityMultiplier} — well-reviewed items lift,
     * poorly-reviewed items sink, items with no reviews stay neutral.
     */
    reviewHeadersByEntityKey?: Map<string /*entityKey*/, IMenuItemReviewHeader> | null;
}

/**
 * Multiplies each item's score by per-cafe proximity weight, per-item weight
 * (drinks down, novelty up), the user's order-history boost
 * (see {@link getOrderHistoryBoostMultiplier}), and a community
 * review-popularity multiplier (see {@link getReviewPopularityMultiplier}).
 * Items with proximity weight 0 are dropped entirely (out-of-range cafes).
 * Sections in WEIGHTING_EXEMPT_SECTION_TYPES are passed through unmodified.
 *
 * The `trySomethingDifferent` section uses an inverted boost: items in
 * `familiarEntityKeys` are heavily demoted instead of being skipped, so the
 * pool never empties out for users with lots of history.
 */
export const applyWeights = (
    items: readonly IRecommendationItem[],
    sectionType: RecommendationSectionType,
    {
        proximityWeights,
        itemWeights,
        orderCountsByEntityKey = null,
        familiarEntityKeys = null,
        reviewHeadersByEntityKey = null,
    }: IApplyWeightsOptions,
): IRecommendationItem[] => {
    if (WEIGHTING_EXEMPT_SECTION_TYPES.has(sectionType)) {
        return items as IRecommendationItem[];
    }

    const isTrySomethingDifferent = sectionType === RecommendationSectionType.trySomethingDifferent;

    if (!proximityWeights && !itemWeights && !reviewHeadersByEntityKey
        && (isTrySomethingDifferent ? !familiarEntityKeys : !orderCountsByEntityKey)) {
        return items as IRecommendationItem[];
    }

    const resultItems: IRecommendationItem[] = [];
    let isAnyWeightNotDefault = false;
    for (const item of items) {
        const proximityWeight = proximityWeights?.get(item.cafeId) ?? 1;
        if (proximityWeight === 0) {
            isAnyWeightNotDefault = true;
            continue;
        }

        const itemWeight = itemWeights?.get(item.menuItemId) ?? 1;

        let historyWeight: number;
        if (isTrySomethingDifferent) {
            // Demote — don't boost — items the user has tried before.
            historyWeight = familiarEntityKeys?.has(item.entityKey)
                ? TRY_SOMETHING_DIFFERENT_FAMILIAR_PENALTY
                : 1;
        } else {
            historyWeight = orderCountsByEntityKey
                ? getOrderHistoryBoostMultiplier(orderCountsByEntityKey.get(item.entityKey) ?? 0)
                : 1;
        }

        let reviewWeight = 1;
        if (reviewHeadersByEntityKey) {
            const header = reviewHeadersByEntityKey.get(item.entityKey);
            if (header) {
                reviewWeight = getReviewPopularityMultiplier(header.overallRating, header.totalReviewCount);
            }
        }

        const combinedWeight = proximityWeight * itemWeight * historyWeight * reviewWeight;

        if (combinedWeight !== 1) {
            isAnyWeightNotDefault = true;
            resultItems.push({
                ...item,
                score: item.score * combinedWeight,
            });
        } else {
            resultItems.push(item);
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
        if (selected.length >= count) {
            break;
        }
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
    itemWeights: Map<string, number> | null;
    orderCountsByEntityKey?: Map<string /*entityKey*/, number> | null;
    familiarEntityKeys?: Set<string> | null;
    reviewHeadersByEntityKey?: Map<string /*entityKey*/, IMenuItemReviewHeader> | null;
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
    itemWeights,
    orderCountsByEntityKey = null,
    familiarEntityKeys = null,
    reviewHeadersByEntityKey = null,
    seed,
    lambda = 0.5,
}: IAssembleSectionsParams): Promise<IRecommendationSection[]> => {
    const result: IRecommendationSection[] = [];
    const tryClaim = (item: IRecommendationItem) => {
        if (claimedKeys.has(item.entityKey)) {
            return false;
        }

        claimedKeys.add(item.entityKey);
        return true;
    }

    for (const sectionType of SECTION_PRIORITY) {
        const items = sectionsByType.get(sectionType);
        if (!items) {
            continue;
        }

        const adjustedItems = applyWeights(items, sectionType, {
            proximityWeights,
            itemWeights,
            orderCountsByEntityKey,
            familiarEntityKeys,
            reviewHeadersByEntityKey,
        });
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
}
