import {
    IRecommendationItem,
    IRecommendationSection,
    RecommendationSectionType,
    RECOMMENDATION_SECTION_DISPLAY_NAMES,
} from '@msdining/common/models/recommendation';
import { SearchEntityType } from '@msdining/common/models/search';
import { getEntityKey } from '@msdining/common/util/entity-key';
import { IMenuItemCandidate, toRecommendationItem, computePopularityScore } from '../../../../util/recommendation.js';
import { retrieveReviewHeaderAsync } from '../../../cache/reviews.js';
import {
    searchSimilarEntitiesByType,
} from '../../../storage/vector/client.js';
import {
    IRecommendationContext,
    log,
    ITEMS_PER_SECTION,
    POSITIVE_REVIEW_THRESHOLD,
    VECTOR_SEARCH_LIMIT,
    HIDDEN_GEM_MAX_REVIEW_COUNT,
    TOP_RATED_SEED_COUNT,
} from '../../shared.js';

/**
 * "Hidden Gems" — finds under-reviewed menu items that are semantically similar to the
 * highest-rated items available today. The idea is to surface items that are probably good
 * (because they resemble popular favorites) but haven't been discovered yet by reviewers.
 *
 * Algorithm:
 * 1. Find the top-rated available items (seeds) based on popularity score
 * 2. Identify "gem candidates" — items with very few reviews (≤ HIDDEN_GEM_MAX_REVIEW_COUNT)
 *    or no review data at all
 * 3. For each seed, do a vector similarity search and match results against gem candidates
 * 4. Rank by vector distance (closest to a well-rated seed = best hidden gem)
 *
 * Shown to all users (anonymous and authenticated). Cached at the anonymous level.
 */
export const getHiddenGems = async (
    context: IRecommendationContext,
    count: number = ITEMS_PER_SECTION,
): Promise<IRecommendationSection | null> => {
    const availableItems = await context.getAllMenuItems();

    // Find the top-rated items to use as seeds (parallel header fetch)
    const headerResults = await Promise.allSettled(
        availableItems.map(async (item) => {
            const header = await retrieveReviewHeaderAsync(item.menuItem);
            return { item, header };
        })
    );

    const seeds: Array<{ item: IMenuItemCandidate; header: { overallRating: number; totalReviewCount: number } }> = [];
    const gemCandidatesByEntityKey = new Map<string, IMenuItemCandidate>();
    const gemCandidatesById = new Map<string, IMenuItemCandidate>();

    for (const result of headerResults) {
        if (result.status !== 'fulfilled') {
            continue;
        }
        const { item, header } = result.value;
        // Would like to require a certain number of reviews, but we don't have a ton of reviews in total yet
        if (/*header.totalReviewCount >= 3 && */header.overallRating >= POSITIVE_REVIEW_THRESHOLD) {
            seeds.push({ item, header });
        }
    }

    if (seeds.length === 0) {
        return null;
    }

    seeds.sort((a, b) => computePopularityScore(b.header.overallRating, b.header.totalReviewCount) - computePopularityScore(a.header.overallRating, a.header.totalReviewCount));
    const topSeeds = seeds.slice(0, TOP_RATED_SEED_COUNT);

    // Build gem candidates from header results
    const seedEntityKeys = new Set(topSeeds.map(seed => getEntityKey(seed.item.menuItem)));
    for (const result of headerResults) {
        if (result.status !== 'fulfilled') {
            // No review data = hidden gem candidate
            continue;
        }
        const { item, header } = result.value;
        const entityKey = getEntityKey(item.menuItem);
        if (seedEntityKeys.has(entityKey) || gemCandidatesByEntityKey.has(entityKey)) {
            continue;
        }
        if (header.totalReviewCount <= HIDDEN_GEM_MAX_REVIEW_COUNT) {
            gemCandidatesByEntityKey.set(entityKey, item);
            gemCandidatesById.set(item.menuItem.id, item);
        }
    }

    // Also add items that failed header fetch (no review data = hidden gem candidate)
    for (let i = 0; i < headerResults.length; i++) {
        if (headerResults[i]!.status === 'rejected') {
            const item = availableItems[i]!;
            const entityKey = getEntityKey(item.menuItem);
            if (!seedEntityKeys.has(entityKey) && !gemCandidatesByEntityKey.has(entityKey)) {
                gemCandidatesByEntityKey.set(entityKey, item);
                gemCandidatesById.set(item.menuItem.id, item);
            }
        }
    }

    if (gemCandidatesByEntityKey.size === 0) {
        return null;
    }

    // Vector search from each seed in parallel
    const candidates = new Map<string, { item: IRecommendationItem; distance: number }>();
    const searchResults = await Promise.all(
        topSeeds.map(async (seed) => {
            try {
                return {
                    seed,
                    results: await searchSimilarEntitiesByType(SearchEntityType.menuItem, seed.item.menuItem.id, VECTOR_SEARCH_LIMIT),
                };
            } catch (error) {
                log.error('Error finding hidden gems for seed:', error);
                return { seed, results: [] };
            }
        })
    );

    for (const { seed, results } of searchResults) {
        for (const result of results) {
            const candidate = gemCandidatesById.get(result.id);
            if (!candidate) {
                continue;
            }

            const entityKey = getEntityKey(candidate.menuItem);
            const existing = candidates.get(entityKey);
            if (!existing || result.distance < existing.distance) {
                candidates.set(entityKey, {
                    item:     toRecommendationItem(
                        candidate,
                        1 - result.distance,
                        `Similar to ${seed.item.menuItem.name}`,
                    ),
                    distance: result.distance,
                });
            }
        }
    }

    const items = Array.from(candidates.values())
        .sort((a, b) => a.distance - b.distance)
        .slice(0, count)
        .map(({ item }) => item);

    if (items.length === 0) {
        return null;
    }

    return {
        type:  RecommendationSectionType.hiddenGems,
        title: RECOMMENDATION_SECTION_DISPLAY_NAMES[RecommendationSectionType.hiddenGems],
        items,
    };
};
