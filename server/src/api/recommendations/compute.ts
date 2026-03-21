import {
	IRecommendationItem,
	IRecommendationSection,
	IRecommendationsResponse,
	RecommendationSectionType,
} from '@msdining/common/models/recommendation';
import { ENTITY_KEY_NAME_PREFIX, getEntityKey } from '@msdining/common/util/entity-key';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { throwError } from '../../util/error.js';
import { lazy } from '../../util/lazy.js';
import { buildProximityWeightMap } from '../../util/proximity.js';
import { createSeededRandom, selectWithFilter } from '../../util/random.js';
import { ReviewStorageClient } from '../storage/clients/review.js';
import { getHiddenGems } from './signals/anonymous/hidden-gems.js';
import { getPopularItems } from './signals/anonymous/popular.js';
import { getBasedOnReviews } from './signals/user-specific/based-on-reviews.js';
import { getNewAtFavorites } from './signals/user-specific/new-at-favorites.js';
import { getTrySomethingDifferent } from './signals/user-specific/try-something-different.js';
import { getAllAvailableItems, IRecommendationContext, ITEMS_PER_SECTION, withErrorHandling } from './shared.js';

// --- Proximity ---

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

// --- Favorites ---

const buildFavoriteEntityKeys = (favoriteItemNames: string[]): Set<string> => {
    const keys = new Set<string>();
    for (const name of favoriteItemNames) {
        keys.add(ENTITY_KEY_NAME_PREFIX + normalizeNameForSearch(name));
    }
    return keys;
};

// --- Section assembly ---

// Sections are processed in this order. Higher-priority sections claim items first;
// lower-priority sections pick from the remaining pool.
const SECTION_PRIORITY: RecommendationSectionType[] = [
    RecommendationSectionType.newAtFavorites,
    RecommendationSectionType.basedOnReviews,
    RecommendationSectionType.popular,
    RecommendationSectionType.hiddenGems,
    RecommendationSectionType.trySomethingDifferent,
];

// Anonymous section types have large pre-computed pools that need variety selection at assembly time.
const ANONYMOUS_SECTION_TYPES = new Set<RecommendationSectionType>([
    RecommendationSectionType.popular,
    RecommendationSectionType.hiddenGems,
]);

const claimItems = (items: IRecommendationItem[], claimedKeys: Set<string>) => {
    for (const item of items) {
        claimedKeys.add(getEntityKey(item));
    }
};

interface IAssembleSectionsParams {
    sectionsByType: Map<RecommendationSectionType, IRecommendationSection>;
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
const assembleSections = ({
    sectionsByType,
    claimedKeys,
    proximityWeights,
    random,
}: IAssembleSectionsParams): IRecommendationSection[] => {
    const result: IRecommendationSection[] = [];
    const isNotClaimed = (item: IRecommendationItem) => !claimedKeys.has(getEntityKey(item));

    for (const sectionType of SECTION_PRIORITY) {
        const section = sectionsByType.get(sectionType);
        if (!section) {
            continue;
        }

        const adjustedItems = applyProximityWeighting(section.items, sectionType, proximityWeights);

        const selectedItems = ANONYMOUS_SECTION_TYPES.has(sectionType)
            ? selectWithFilter(adjustedItems, ITEMS_PER_SECTION, random, isNotClaimed)
            : adjustedItems.filter(isNotClaimed);

        if (selectedItems.length === 0) {
            continue;
        }

        claimItems(selectedItems, claimedKeys);
        result.push({ ...section, items: selectedItems });
    }

    return result;
};

// --- Context building ---

type BuildContextParams = Pick<IRecommendationContext, 'userId' | 'dateString' | 'homepageIds' | 'cafeIdFilter' | 'getNewItemsForCafe'>;

const buildContext = ({
    userId = null,
    dateString,
    homepageIds,
    cafeIdFilter,
    getNewItemsForCafe,
}: BuildContextParams): IRecommendationContext => {
    const random = createSeededRandom(`${dateString}:${userId ?? 'anon'}`);

    return {
        userId,
        dateString,
        homepageIds,
        cafeIdFilter,
        random,
        getAllMenuItems:    lazy(() => getAllAvailableItems(dateString, cafeIdFilter)),
        getUserReviews:     lazy(() => userId
            ? ReviewStorageClient.getReviewsForUserAsync({ userId })
            : Promise.resolve([])),
        getNewItemsForCafe,
    } satisfies IRecommendationContext;
};

// --- Signal dispatching ---

const computeUserSpecificSections = (context: IRecommendationContext): Promise<Array<IRecommendationSection | null>> => {
    const promises: Array<Promise<IRecommendationSection | null>> = [];
    const { homepageIds, cafeIdFilter, userId } = context;

    if (homepageIds.length > 0 || cafeIdFilter) {
        promises.push(withErrorHandling('newAtFavorites', getNewAtFavorites(context)));
    }

    if (userId) {
        promises.push(withErrorHandling('basedOnReviews', getBasedOnReviews(context)));
        promises.push(withErrorHandling('trySomethingDifferent', getTrySomethingDifferent(context)));
    }

    return Promise.all(promises);
};

const collectSections = (
    ...sectionLists: Array<ReadonlyArray<IRecommendationSection | null>>
): Map<RecommendationSectionType, IRecommendationSection> => {
    const map = new Map<RecommendationSectionType, IRecommendationSection>();
    for (const sections of sectionLists) {
        for (const section of sections) {
            if (section) {
                map.set(section.type, section);
            }
        }
    }
    return map;
};

// --- Public API ---

/**
 * Computes the anonymous recommendation sections (Popular Today, Hidden Gems).
 * These are user-independent and can be cached globally.
 */
export const computeAnonymousSections = async (dateString: string, cafeIdFilter?: Set<string>): Promise<IRecommendationSection[]> => {
    const context = buildContext({
        userId:             null,
        homepageIds:        [],
        getNewItemsForCafe: () => throwError('getNewItemsForCafe should not be called for anonymous recommendations'),
        dateString,
        cafeIdFilter,
    });

    const results = await Promise.all([
        withErrorHandling('popular', getPopularItems(context)),
        withErrorHandling('hiddenGems', getHiddenGems(context)),
    ]);

    return results.filter((section): section is IRecommendationSection => section != null);
};

/**
 * Computes the full recommendations response for a user by assembling sections from
 * multiple signals.
 *
 * All signals are computed in parallel. After they resolve, sections are assembled in
 * priority order with dedup-aware selection: higher-priority sections claim items first,
 * and lower-priority sections pick from the remaining pool. User favorites are pre-excluded
 * so recommendation sections don't redundantly show favorited items.
 */
interface IComputeRecommendationsParams {
    anonymousSections: IRecommendationSection[];
    userId: string | null;
    dateString: string;
    homepageIds: string[];
    cafeIdFilter?: Set<string>;
    favoriteItemNames: string[];
    getNewItemsForCafe: (cafeId: string) => Promise<IRecommendationItem[]>;
}

export const computeRecommendations = async ({
    anonymousSections,
    userId,
    dateString,
    homepageIds,
    cafeIdFilter,
    favoriteItemNames,
    getNewItemsForCafe,
}: IComputeRecommendationsParams): Promise<IRecommendationsResponse> => {
    const context = buildContext({ userId, dateString, homepageIds, cafeIdFilter, getNewItemsForCafe });

    const userSections = await computeUserSpecificSections(context);
    const sectionsByType = collectSections(anonymousSections, userSections);
    const claimedKeys = buildFavoriteEntityKeys(favoriteItemNames);
    const proximityWeights = buildProximityWeightMap(homepageIds, cafeIdFilter);

    const sections = assembleSections({
        sectionsByType,
        claimedKeys,
        proximityWeights,
        random: context.random,
    });

    return { sections };
};
