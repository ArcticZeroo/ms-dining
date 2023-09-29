import { ISearchResult, SearchResultsByItemName } from '../models/search.ts';
import { findLongestNonSequentialSubstringLength, findLongestSequentialSubstringLength } from './string.ts';
import { DiningClient } from '../api/dining.ts';
import { CafeView, ICafe } from '../models/cafe.ts';

const normalizeId = (id: string) => {
    id = id.toLowerCase();

    if (id.startsWith('cafe')) {
        id = id.substring('cafe'.length);
    }

    return id;
}

export const sortCafeIds = (ids: string[]) => {
    const normalizedIdsByOriginalId = new Map<string, string>();

    const getNormalizedId = (id: string) => {
        if (!normalizedIdsByOriginalId.has(id)) {
            normalizedIdsByOriginalId.set(id, normalizeId(id));
        }
        return normalizedIdsByOriginalId.get(id)!;
    }

    return ids.sort((a, b) => {
        const normalizedA = getNormalizedId(a);
        const normalizedB = getNormalizedId(b);

        const numberA = Number(normalizedA);
        const numberB = Number(normalizedB);

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
    // Divide the total number of cafes to avoid giving too much priority here
    const totalRelevancyScore = searchResult.cafeIds.reduce((score, cafeId) => {
        const priorityIndex = cafePriorityOrder.indexOf(cafeId);
        const priorityScore = priorityIndex === -1 ? 0 : (cafePriorityOrder.length - priorityIndex);
        return score + priorityScore;
    }, 0);
    return ((totalRelevancyScore / searchResult.cafeIds.length) / cafePriorityOrder.length) + searchResult.cafeIds.length;
}

const computeScore = (cafePriorityOrder: string[], itemName: string, searchResult: ISearchResult, queryText: string) => {
    // TODO: Should I remove whitespace? Probably not?
    itemName = itemName.toLowerCase();
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

    return (longestSequentialSubstringLength * 20)
        + (longestNonSequentialSubstringLength * 5)
        + cafeRelevancyScore;
}

interface ISortSearchResultsParams {
    searchResultsByItemName: SearchResultsByItemName;
    queryText: string;
    cafes: ICafe[];
    viewsById: Map<string, CafeView>;
}

export const sortSearchResults = ({
                                      searchResultsByItemName,
                                      queryText,
                                      cafes,
                                      viewsById
                                  }: ISortSearchResultsParams) => {
    const cafePriorityOrder = DiningClient.getCafePriorityOrder(cafes, viewsById).map(cafe => cafe.id);

    const searchResultEntries = Array.from(searchResultsByItemName.entries());

    const scoresByItemName = new Map<string, number>();

    const getScore = (itemName: string, searchResult: ISearchResult) => {
        if (!scoresByItemName.has(itemName)) {
            scoresByItemName.set(itemName, computeScore(cafePriorityOrder, itemName, searchResult, queryText));
        }
        return scoresByItemName.get(itemName)!;
    };

    searchResultEntries.sort(([itemNameA, resultA], [itemNameB, resultB]) => {
        const scoreA = getScore(itemNameA, resultA);
        const scoreB = getScore(itemNameB, resultB);

        if (scoreA === scoreB) {
            return resultA.stableId - resultB.stableId;
        }

        return scoreB - scoreA;
    });

    return searchResultEntries;
}