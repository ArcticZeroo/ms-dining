import { ISearchResult, SearchResultsByItemName } from '../models/search.ts';
import { findLongestSequentialSubstringLength, findLongestNonSequentialSubstringLength } from './string.ts';
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

const computeScore = (cafePriorityOrder: string[], itemName: string, searchResult: ISearchResult, queryText: string) => {
    // TODO: Should I remove whitespace? Probably not?
    itemName = itemName.toLowerCase();

    const longestSequentialSubstringLength = findLongestSequentialSubstringLength(itemName, queryText);
    const longestNonSequentialSubstringLength = findLongestNonSequentialSubstringLength(itemName, queryText);

    return (longestSequentialSubstringLength * 20)
        + (longestNonSequentialSubstringLength * 10)
        + searchResult.cafeIds.length
        // Divide the total number of cafes to avoid giving too much priority here
        + searchResult.cafeIds.reduce((score, cafeId) => {
            const priorityIndex = cafePriorityOrder.indexOf(cafeId);
            const priorityScore = priorityIndex === -1 ? 0 : (cafePriorityOrder.length - priorityIndex);
            return score + priorityScore;
        }, 0) / cafePriorityOrder.length;
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