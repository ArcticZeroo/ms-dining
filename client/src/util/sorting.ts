import {
    allSearchEntityTypes,
    ISearchResult,
    SearchEntityFilterType,
    SearchEntityType,
    SearchResultsMap
} from '../models/search.ts';
import { findLongestNonSequentialSubstringLength, findLongestSequentialSubstringLength } from './string.ts';
import { DiningClient } from '../api/dining.ts';
import { CafeView, ICafe } from '../models/cafe.ts';

const normalizeId = (id: string) => {
    return id
        .toLowerCase()
        .replace(/^cafe /, '');
}

export const sortCafeIds = (cafeIds: Iterable<string>) => {
    const normalizedIdsByOriginalId = new Map<string, string>();

    const getNormalizedId = (id: string) => {
        if (!normalizedIdsByOriginalId.has(id)) {
            normalizedIdsByOriginalId.set(id, normalizeId(id));
        }
        return normalizedIdsByOriginalId.get(id)!;
    }

    return Array.from(cafeIds).sort((a, b) => {
        const normalizedA = getNormalizedId(a);
        const normalizedB = getNormalizedId(b);

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

    for (const cafeId of searchResult.cafeIds) {
        const priorityIndex = cafePriorityOrder.indexOf(cafeId);
        const priorityScore = priorityIndex === -1 ? 0 : (cafePriorityOrder.length - priorityIndex);
        totalRelevancyScore += priorityScore;
    }

    // Divide the total number of cafes to avoid giving too much priority here
    return ((totalRelevancyScore / searchResult.cafeIds.size) / cafePriorityOrder.length) + searchResult.cafeIds.size;
}

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

    const baseScore = (longestSequentialSubstringLength * 20)
        + (longestNonSequentialSubstringLength * 5)
        + cafeRelevancyScore;

    if (searchResult.entityType === SearchEntityType.menuItem) {
        return baseScore;
    } else {
        // Stations should not be ranked as high as menu items
        return baseScore / 1.5;
    }
}

const flattenSearchResults = (searchResults: SearchResultsMap, entityTypes: Set<SearchEntityType>): ISearchResult[] => {
    const flattenedSearchResults: ISearchResult[] = [];

    for (const [entityType, resultsByName] of searchResults.entries()) {
        if (!entityTypes.has(entityType)) {
            continue;
        }

        for (const result of resultsByName.values()) {
            flattenedSearchResults.push(result);
        }
    }

    return flattenedSearchResults;
}

export const getAllowedSearchEntityTypes = (filterType: SearchEntityFilterType): Set<SearchEntityType> => {
    switch (filterType) {
        case SearchEntityFilterType.all:
            return new Set(allSearchEntityTypes);
        case SearchEntityFilterType.menuItem:
            return new Set([SearchEntityType.menuItem]);
        case SearchEntityFilterType.station:
            return new Set([SearchEntityType.station]);
        default:
            throw new Error('Invalid filter type!');
    }
}

interface ISortSearchResultsParams {
    searchResults: SearchResultsMap;
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
                                      entityType
                                  }: ISortSearchResultsParams): ISearchResult[] => {
    const allowedEntityTypes = getAllowedSearchEntityTypes(entityType);
    const cafePriorityOrder = DiningClient.getCafePriorityOrder(cafes, viewsById).map(cafe => cafe.id);
    const flattenedSearchResults = flattenSearchResults(searchResults, allowedEntityTypes);
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

    flattenedSearchResults.sort((resultA, resultB) => {
        const scoreA = getScore(resultA);
        const scoreB = getScore(resultB);

        if (scoreA === scoreB) {
            return resultA.stableId - resultB.stableId;
        }

        return scoreB - scoreA;
    });

    return flattenedSearchResults;
}