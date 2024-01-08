import { ISearchResult, SearchEntityType, SearchMatchReason } from '../models/search.js';
import { findLongestNonSequentialSubstringLength, findLongestSequentialSubstringLength } from './string-util.js';

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

	if (matchReason === SearchMatchReason.title) {
		return baseScore;
	}

	return baseScore * 0.75;
};

const computeScore = (cafePriorityOrder: string[] | undefined, searchResult: ISearchResult, queryText: string, doSubstringScore: boolean) => {
	let totalSubstringScore = 0;
	if (doSubstringScore) {
		for (const matchReason of searchResult.matchReasons) {
			totalSubstringScore += getSubstringScoreForMatchReason(queryText, searchResult, matchReason);
		}
		totalSubstringScore /= searchResult.matchReasons.size;
	}

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

enum MatchType {
	perfect = 3,
	substring = 2,
	fuzzy = 1
}

interface ISearchSortMetadata {
	matchType: MatchType;
	score: number;
	result: ISearchResult;
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

const getMatchType = (searchResult: ISearchResult, queryText: string, perfectMatchRegex: RegExp) => {
	let matchType = MatchType.fuzzy;

	for (const reason of searchResult.matchReasons) {
		const targetText = getTargetText(searchResult, reason);

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
	queryText = queryText.toLowerCase();

	const perfectMatchRegex = new RegExp(`\\b${queryText}\\b`, 'i');

	const searchResultMetadataByEntityType = new Map<SearchEntityType, Map<string, ISearchSortMetadata>>();

	const getMetadata = (searchResult: ISearchResult) => {
		if (!searchResultMetadataByEntityType.has(searchResult.entityType)) {
			searchResultMetadataByEntityType.set(searchResult.entityType, new Map());
		}

		const searchResultMetadataByName = searchResultMetadataByEntityType.get(searchResult.entityType)!;

		if (!searchResultMetadataByName.has(searchResult.name)) {
			const matchType = getMatchType(searchResult, queryText, perfectMatchRegex);

			searchResultMetadataByName.set(searchResult.name, {
				matchType,
				result: searchResult,
				score:  computeScore(
					cafePriorityOrder,
					searchResult,
					queryText,
					matchType !== MatchType.perfect /*doSubstringScore*/
				)
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

// e.g. Chipotle Chicken + Bacon Sub should also match "Chipotle Chicken Bacon Sub" or "Chipotle Chicken and Bacon Sub"
export const normalizeNameForSearch = (name: string) => name
	.toLowerCase()
	.trim()
	.replace(/^the /i, '')
	.replaceAll(/(\W|\s|\s+\s|\sand\s)/ig, '');
