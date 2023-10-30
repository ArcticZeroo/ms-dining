import { ISearchResult, SearchEntityFilterType, SearchEntityType } from '../models/search.ts';
import { findLongestNonSequentialSubstringLength, findLongestSequentialSubstringLength } from './string.ts';
import { DiningClient } from '../api/dining.ts';
import { CafeView, ICafe } from '../models/cafe.ts';

export const normalizeCafeId = (id: string) => {
    return id
        .toLowerCase()
        .replace(/^cafe/, '');
}

export const compareNormalizedCafeIds = (normalizedA: string, normalizedB: string) => {
    // Normally I don't like parseInt, but for once
    // I am going to intentionally rely on the weird
    // parsing behavior.
    // Cafe 40-41 will be normalized to "40-41", which
    // fails to parse under Number but will parse into
    // 40 under parseInt.
    const numberA = parseInt(normalizedA);
    const numberB = parseInt(normalizedB);

    const isNumberA = !Number.isNaN(numberA);
    const isNumberB = !Number.isNaN(numberB);

    if (isNumberA && isNumberB) {
        return numberA - numberB;
    }

    // Put numeric cafes at the bottom of the list
    if (isNumberA) {
        return 1;
    }

    if (isNumberB) {
        return -1;
    }

    return normalizedA.localeCompare(normalizedB);
};

export const sortCafeIds = (cafeIds: Iterable<string>) => {
    const normalizedIdsByOriginalId = new Map<string, string>();

    const getNormalizedId = (id: string) => {
        if (!normalizedIdsByOriginalId.has(id)) {
            normalizedIdsByOriginalId.set(id, normalizeCafeId(id));
        }
        return normalizedIdsByOriginalId.get(id)!;
    }

    return Array.from(cafeIds).sort((a, b) => {
        const normalizedA = getNormalizedId(a);
        const normalizedB = getNormalizedId(b);

        return compareNormalizedCafeIds(normalizedA, normalizedB);
    });
}

interface ISubstringScoreParams {
    itemName: string;
    queryText: string;
    isSequential: boolean;
    perfectMatchScore?: number;
    perfectMatchWithoutBoundaryScore?: number;
}

const getSubstringScore = ({
                               itemName,
                               queryText,
                               isSequential,
                               perfectMatchScore,
                               perfectMatchWithoutBoundaryScore
                           }: ISubstringScoreParams) => {
    const substringLength = isSequential
        ? findLongestSequentialSubstringLength(itemName, queryText)
        : findLongestNonSequentialSubstringLength(itemName, queryText);

    const queryLength = queryText.length;

    if (queryLength === substringLength) {
        // A "perfect match" is not only the exact substring, but is on a word boundary too
        // e.g. "Pumpkin Spice Latte" should score higher than "Platter" for the search term "Latte"
        if (perfectMatchScore && new RegExp(`\\b${queryText}\\b`).test(itemName)) {
            return perfectMatchScore;
        }

        if (perfectMatchWithoutBoundaryScore) {
            return perfectMatchWithoutBoundaryScore;
        }
    }

    return substringLength / queryLength;
}

const getCafeRelevancyScore = (searchResult: ISearchResult, cafePriorityOrder: string[]) => {
    let totalRelevancyScore = 0;

    const cafeIds = new Set(Array.from(searchResult.locationDatesByCafeId.keys()));

    for (const cafeId of cafeIds) {
        const priorityIndex = cafePriorityOrder.indexOf(cafeId);
        const priorityScore = priorityIndex === -1 ? 0 : (cafePriorityOrder.length - priorityIndex);
        totalRelevancyScore += priorityScore;
    }

    // Divide the total number of cafes to avoid giving too much priority here
    return ((totalRelevancyScore / cafeIds.size) / cafePriorityOrder.length) + cafeIds.size;
}

const getDateRelevancyScore = (searchResult: ISearchResult) => {
    let totalRelevancyScore = 0;
    let totalDateCount = 0;

    const nowDay = new Date().getDay();

    for (const dates of searchResult.locationDatesByCafeId.values()) {
        for (const date of dates) {
            const daysFromNow = date.getDay() - nowDay;
            totalRelevancyScore += (0.75 ** Math.abs(daysFromNow));
            totalRelevancyScore += 1;
        }
    }

    return ((totalRelevancyScore * 5) / totalDateCount) + totalDateCount;
};

const computeScore = (cafePriorityOrder: string[], searchResult: ISearchResult, queryText: string) => {
    // TODO: Should I remove whitespace? Probably not?
    const itemName = searchResult.name.toLowerCase();
    queryText = queryText.toLowerCase();

    const longestSequentialSubstringLength = getSubstringScore({
        itemName,
        queryText,
        isSequential:                     true,
        perfectMatchWithoutBoundaryScore: 1.25,
        perfectMatchScore:                2
    });

    const longestNonSequentialSubstringLength = getSubstringScore({
        itemName,
        queryText,
        isSequential:                     false,
        perfectMatchWithoutBoundaryScore: 1.25,
    });

    const cafeRelevancyScore = getCafeRelevancyScore(searchResult, cafePriorityOrder);
    const dateRelevancyScore = getDateRelevancyScore(searchResult);

    const baseScore = (longestSequentialSubstringLength * 20)
        + (longestNonSequentialSubstringLength * 5)
        + cafeRelevancyScore
        + dateRelevancyScore;

    if (searchResult.entityType === SearchEntityType.menuItem) {
        return baseScore;
    } else {
        // Stations should not be ranked as high as menu items
        return baseScore / 1.5;
    }
}

interface ISortSearchResultsParams {
    searchResults: ISearchResult[];
    queryText: string;
    cafes: ICafe[];
    viewsById: Map<string, CafeView>;
    entityType: SearchEntityFilterType;
}

export const sortSearchResults = ({
                                      searchResults,
                                      queryText,
                                      cafes,
                                      viewsById,
                                  }: ISortSearchResultsParams): ISearchResult[] => {
    const cafePriorityOrder = DiningClient.getCafePriorityOrder(cafes, viewsById).map(cafe => cafe.id);
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
}