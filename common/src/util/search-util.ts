import { findLongestNonSequentialSubstringLength, findLongestSequentialSubstringLength } from './string-util.js';
import { ISearchResult, SearchEntityType, SearchMatchReason } from '../models/search.js';

// Basic fuzzy search via https://stackoverflow.com/a/15252131
export const fuzzySearch = (source: string, search: string) => {
    const hay = source.toLowerCase();
    let i = 0;
    let n = -1;
    let l;
    search = search.toLowerCase();
    for (; l = search[i++];) {
        if (!~(n = hay.indexOf(l, n + 1))) {
            return false;
        }
    }
    return true;
};

export const normalizeNameForSearch = (name: string) => name.toLowerCase().trim().replaceAll(/\s+/g, '');

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

const getCafeRelevancyScore = (searchResult: ISearchResult, cafePriorityOrder: string[] | undefined) => {
    const cafeIds = new Set(Array.from(searchResult.locationDatesByCafeId.keys()));
    if (!cafePriorityOrder) {
        return cafeIds.size;
    }

    let totalRelevancyScore = 0;

    for (const cafeId of cafeIds) {
        const priorityIndex = cafePriorityOrder.indexOf(cafeId);
        const priorityScore = priorityIndex === -1 ? 0 : (cafePriorityOrder.length - priorityIndex);
        totalRelevancyScore += priorityScore;
    }

    // Divide the total number of cafes to avoid giving too much priority here
    return ((totalRelevancyScore / cafeIds.size) / cafePriorityOrder.length) + cafeIds.size;
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
        //
        totalRelevancyScore += (dates.length / 5);
        totalDateCount += 1;
    }

    return (5 * totalRelevancyScore / totalDateCount) + totalDateCount;
};

const getSubstringScoreForMatchReason = (queryText: string, searchResult: ISearchResult, matchReason: SearchMatchReason) => {
    const targetText = matchReason === SearchMatchReason.title ? searchResult.name : searchResult.description;
    const matchingText = targetText?.trim().toLowerCase();

    if (!matchingText) {
        return 0;
    }

    const longestSequentialSubstringLength = getSubstringScore({
        isSequential:                     true,
        perfectMatchWithoutBoundaryScore: 1.25,
        perfectMatchScore:                2,
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
        + (longestNonSequentialSubstringLength * 5);

    if (matchReason === SearchMatchReason.title) {
        return baseScore;
    }

    return baseScore * 0.75;
};

const computeScore = (cafePriorityOrder: string[] | undefined, searchResult: ISearchResult, queryText: string) => {
    queryText = queryText.toLowerCase();

    let totalSubstringScore = 0;
    for (const matchReason of searchResult.matchReasons) {
        totalSubstringScore += getSubstringScoreForMatchReason(queryText, searchResult, matchReason);
    }
    totalSubstringScore /= searchResult.matchReasons.size;

    const cafeRelevancyScore = getCafeRelevancyScore(searchResult, cafePriorityOrder);
    const dateRelevancyScore = getDateRelevancyScore(searchResult);

    const baseScore = totalSubstringScore
        + cafeRelevancyScore
        + dateRelevancyScore;

    if (searchResult.entityType === SearchEntityType.menuItem) {
        return baseScore;
    } else {
        // Stations should not be ranked as high as menu items
        return baseScore * 0.8;
    }
};

interface ISortSearchResultsParams {
    searchResults: ISearchResult[];
    queryText: string;
    cafePriorityOrder?: string[];
}

export const sortSearchResults = ({
                                      searchResults,
                                      queryText,
                                      cafePriorityOrder
                                  }: ISortSearchResultsParams): ISearchResult[] => {
    const searchResultScores = new Map<SearchEntityType, Map<string, number>>();

    const getScore = (searchResult: ISearchResult) => {
        if (!searchResultScores.has(searchResult.entityType)) {
            searchResultScores.set(searchResult.entityType, new Map());
        }

        const searchResultScoresByItemName = searchResultScores.get(searchResult.entityType)!;

        if (!searchResultScoresByItemName.has(searchResult.name)) {
            searchResultScoresByItemName.set(searchResult.name, computeScore(cafePriorityOrder, searchResult, queryText));
        }
        return searchResultScoresByItemName.get(searchResult.name)!;
    };

    searchResults.sort((resultA, resultB) => {
        const scoreA = getScore(resultA);
        const scoreB = getScore(resultB);

        return scoreB - scoreA;
    });

    return searchResults;
};
