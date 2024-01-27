import { CafeView, CafeViewType } from '../models/cafe.ts';
import {
    findLongestNonSequentialSubstringLength,
    findLongestSequentialSubstringLength
} from '@msdining/common/dist/util/string-util';
import { getParentView } from './view.ts';
import { ISearchResult, SearchEntityType, SearchMatchReason } from '@msdining/common/dist/models/search';
import { IQuerySearchResult } from '../models/search.ts';
import { ILocationCoordinates } from '@msdining/common/dist/models/util';
import { getCafeLocation } from './cafe.ts';
import { getDistanceBetweenCoordinates } from './user-location.ts';

interface ISearchResultSortingContext {
    viewsById: Map<string, CafeView>;
    queryText: string;
    cafePriorityOrder: string[];
    userLocation: ILocationCoordinates | null;
    homepageViewIds: Set<string>;
    isUsingGroups: boolean;
}

interface ISubstringScoreParams {
    matchingText: string;
    queryText: string;
    isSequential: boolean;
    perfectMatchScore?: number;
    perfectMatchWithoutBoundaryScore?: number;
}

const getSubstringScore = ({
    matchingText,
    queryText,
    isSequential,
    perfectMatchScore,
    perfectMatchWithoutBoundaryScore
}: ISubstringScoreParams) => {
    const substringLength = isSequential
        ? findLongestSequentialSubstringLength(matchingText, queryText)
        : findLongestNonSequentialSubstringLength(matchingText, queryText);

    const queryLength = queryText.length;

    if (queryLength === substringLength) {
        // A "perfect match" is not only the exact substring, but is on a word boundary too
        // e.g. "Pumpkin Spice Latte" should score higher than "Platter" for the search term "Latte"
        if (perfectMatchScore && new RegExp(`\\b${queryText}\\b`).test(matchingText)) {
            return perfectMatchScore;
        }

        if (perfectMatchWithoutBoundaryScore) {
            return perfectMatchWithoutBoundaryScore;
        }
    }

    return substringLength / queryLength;
};

const getCafePriorityScore = (cafeId: string, cafePriorityOrder: string[]) => {
    const priorityIndex = cafePriorityOrder.indexOf(cafeId);
    return priorityIndex === -1 ? 0 : (cafePriorityOrder.length - priorityIndex);
}

const getCafeHomepageScore = (cafeId: string, context: ISearchResultSortingContext) => {
    const cafeView = context.viewsById.get(cafeId);

    // Weird, but OK?
    if (!cafeView) {
        return 0;
    }

    const parentView = getParentView(context.viewsById, cafeView, context.isUsingGroups);

    return context.homepageViewIds.has(parentView.value.id) ? 5 : 0;
}

// This is generally expected to only be useful to people who are already on campus.
// If you're not on campus, you probably don't care about the distance to a cafe.
// I have empirically found that the max distance between any building and cafe on campus
// is approximately 1.5 miles (tested at One Esterra, Building 4, Building 32).
// const MAX_DISTANCE_MILES = 1.5;

const getLocationCurveScore = (distanceInMiles: number) => {
    // This is a downward-facing stepped curve which starts at roughly y=1 when x=0 and reaches y=0 at roughly x=1
    return -(3.1125 + 0.1 * (Math.sin(10 * distanceInMiles - 4.2) + 10 * (distanceInMiles - 4.2))) - 0.25 * Math.sin(distanceInMiles) / Math.PI;

    // This is a downward-facing curve that starts at y=1 when x=0 and reaches y=0 at x=1.5
    // return 2 - Math.pow(Math.E, ((Math.log(2) / MAX_DISTANCE_MILES) * distanceInMiles));
}

const getCafeLocationScore = (cafeId: string, context: ISearchResultSortingContext) => {
    if (!context.userLocation) {
        return 0;
    }

    const cafeView = context.viewsById.get(cafeId);

    // Weird, but OK?
    if (!cafeView || cafeView.type === CafeViewType.group) {
        return 0;
    }

    const cafeLocation = getCafeLocation(cafeView.value);

    if (!cafeLocation) {
        return 0;
    }

    const distanceInMiles = getDistanceBetweenCoordinates(
        context.userLocation,
        cafeLocation,
        true /*inMiles*/
    );

    // Intentional that this makes cafes which are >MAX_DISTANCE_MILES away have a negative score here.
    return getLocationCurveScore(distanceInMiles);
}

const getCafeHitsRelevancyTotalScore = (searchResult: ISearchResult, context: ISearchResultSortingContext) => {
    const cafeIds = new Set(Array.from(searchResult.locationDatesByCafeId.keys()));

    let totalRelevancyScore = 0;
    let bestPriorityScore = 0;
    let bestHomepageScore = 0;
    let bestLocationScore = 0;

    for (const cafeId of cafeIds) {
        const priorityScore = getCafePriorityScore(cafeId, context.cafePriorityOrder) / context.cafePriorityOrder.length;
        const homepageScore = getCafeHomepageScore(cafeId, context);
        const locationScore = getCafeLocationScore(cafeId, context);

        bestPriorityScore = Math.max(bestPriorityScore, priorityScore);
        bestHomepageScore = Math.max(bestHomepageScore, homepageScore);
        bestLocationScore = Math.max(bestLocationScore, locationScore);

        totalRelevancyScore += priorityScore + homepageScore + locationScore;
    }

    // We want to reward cafes that are highly ranked, even if there are lots of lowly-ranked cafes
    // e.g. all the cafes are very far away, but one is very close and is the homepage cafe. Or something like that.
    const averageBestScorePerCafe = (bestPriorityScore + bestHomepageScore + bestLocationScore) / (3 * cafeIds.size);

    // Divide the total number of cafes to avoid giving too much priority here
    return (totalRelevancyScore / cafeIds.size) + cafeIds.size + averageBestScorePerCafe;
};

const getDateRelevancyScore = (searchResult: ISearchResult) => {
    let totalRelevancyScore = 0;
    let totalDateCount = 0;

    const nowDay = new Date().getDay();

    for (const dates of searchResult.locationDatesByCafeId.values()) {
        // These are sorted, so we'll just grab the next most recent one
        const nextDate = dates[0];
        const daysFromNow = nextDate.getDay() - nowDay;
        totalRelevancyScore += (0.75 ** Math.abs(daysFromNow));
        totalRelevancyScore += (dates.length / 5);
        totalDateCount += dates.length;
    }

    return (5 * totalRelevancyScore / totalDateCount) + totalDateCount;
};

const MATCH_REASON_MULTIPLIERS: Record<SearchMatchReason, number> = {
    [SearchMatchReason.title]:       1,
    [SearchMatchReason.description]: 0.75
};

const getSubstringScoreForMatchReason = (queryText: string, searchResult: ISearchResult, matchReason: SearchMatchReason) => {
    const targetText = matchReason === SearchMatchReason.title ? searchResult.name : searchResult.description;
    const matchingText = targetText?.trim().toLowerCase();

    if (!matchingText) {
        return 0;
    }

    const longestSequentialSubstringLength = getSubstringScore({
        isSequential:                     true,
        perfectMatchWithoutBoundaryScore: 2,
        perfectMatchScore:                5,
        matchingText,
        queryText,
    });

    const longestNonSequentialSubstringLength = getSubstringScore({
        isSequential:                     false,
        perfectMatchWithoutBoundaryScore: 1.25,
        matchingText,
        queryText,
    });

    const baseScore = (longestSequentialSubstringLength * 20)
        + (longestNonSequentialSubstringLength * 2);

    return baseScore * MATCH_REASON_MULTIPLIERS[matchReason];
};

interface IComputeScoreParams {
    searchResult: ISearchResult;
    doSubstringScore: boolean;
    context: ISearchResultSortingContext;
}

const ENTITY_TYPE_MULTIPLIERS: Record<SearchEntityType, number> = {
    [SearchEntityType.menuItem]: 1,
    [SearchEntityType.station]:  0.8
};

const computeScore = ({ searchResult, doSubstringScore, context }: IComputeScoreParams) => {
    let totalSubstringScore = 0;
    if (doSubstringScore) {
        for (const matchReason of searchResult.matchReasons) {
            totalSubstringScore += getSubstringScoreForMatchReason(context.queryText, searchResult, matchReason);
        }
        totalSubstringScore /= searchResult.matchReasons.size;
    }

    const cafeRelevancyScore = getCafeHitsRelevancyTotalScore(searchResult, context);
    const dateRelevancyScore = getDateRelevancyScore(searchResult);

    const baseScore = totalSubstringScore
        + cafeRelevancyScore
        + dateRelevancyScore;

    return baseScore * ENTITY_TYPE_MULTIPLIERS[searchResult.entityType];
};

enum MatchType {
    perfect = 3,
    substring = 2,
    fuzzy = 1
}

const getTargetText = (searchResult: ISearchResult, matchReason: SearchMatchReason) => {
    switch (matchReason) {
    case SearchMatchReason.title:
        return searchResult.name;
    case SearchMatchReason.description:
        return searchResult.description;
    default:
        throw new Error(`Unexpected match reason: ${matchReason}`);
    }
};

const getMatchType = (searchResult: ISearchResult, queryText: string, perfectMatchRegex: RegExp): MatchType => {
    let matchType = MatchType.fuzzy;

    for (const reason of searchResult.matchReasons) {
        const targetText = getTargetText(searchResult, reason);

        // Expected in case search result merging isn't working properly
        if (!targetText) {
            continue;
        }

        if (targetText === queryText || perfectMatchRegex.test(targetText)) {
            return MatchType.perfect;
        }

        // We might find a perfect match for another match reason later
        if (targetText.includes(queryText)) {
            matchType = MatchType.substring;
        }
    }

    return matchType;
};

interface ISearchSortMetadata {
    matchType: MatchType;
    score: number;
    result: ISearchResult;
}

export const sortSearchResults = (searchResults: IQuerySearchResult[], context: ISearchResultSortingContext): IQuerySearchResult[] => {
    context.queryText = context.queryText.toLowerCase();

    const perfectMatchRegex = new RegExp(`\\b${context.queryText}\\b`, 'i');

    const searchResultMetadataByEntityType = new Map<SearchEntityType, Map<string, ISearchSortMetadata>>();

    const getMetadata = (searchResult: ISearchResult) => {
        if (!searchResultMetadataByEntityType.has(searchResult.entityType)) {
            searchResultMetadataByEntityType.set(searchResult.entityType, new Map());
        }

        const searchResultMetadataByName = searchResultMetadataByEntityType.get(searchResult.entityType)!;

        if (!searchResultMetadataByName.has(searchResult.name)) {
            const matchType = getMatchType(searchResult, context.queryText, perfectMatchRegex);

            searchResultMetadataByName.set(searchResult.name, {
                matchType,
                result: searchResult,
                score:  computeScore({
                    searchResult,
                    context,
                    doSubstringScore: matchType !== MatchType.perfect /*doSubstringScore*/,
                })
            });
        }

        return searchResultMetadataByName.get(searchResult.name)!;
    };

    searchResults.sort((resultA, resultB) => {
        const metadataA = getMetadata(resultA);
        const metadataB = getMetadata(resultB);

        if (metadataA.matchType !== metadataB.matchType) {
            return metadataB.matchType - metadataA.matchType;
        }

        return metadataB.score - metadataA.score;
    });

    return searchResults;
};
