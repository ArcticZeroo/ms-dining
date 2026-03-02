import { normalizeNameForSearch } from './search-util.js';

const STRIP_PATTERN = /[\s\p{P}]/gu;

/**
 * @deprecated Use {@link normalizeNameForSearch} instead.
 */
export const normalizeForAutocomplete = (text: string): string => {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(STRIP_PATTERN, '');
};

// Bounded Levenshtein distance that bails early if distance exceeds maxDistance.
export const boundedLevenshtein = (source: string, target: string, maxDistance: number): number => {
	const sourceLength = source.length;
	const targetLength = target.length;

	if (Math.abs(sourceLength - targetLength) > maxDistance) {
		return maxDistance + 1;
	}

	let previous = Array.from({ length: targetLength + 1 }, (_, index) => index);
	let current = new Array<number>(targetLength + 1).fill(0);

	for (let i = 1; i <= sourceLength; i++) {
		current[0] = i;
		let rowMin = i;

		for (let j = 1; j <= targetLength; j++) {
			const cost = source[i - 1] === target[j - 1] ? 0 : 1;
			const deletionCost = previous[j]! + 1;
			const insertionCost = current[j - 1]! + 1;
			const substitutionCost = previous[j - 1]! + cost;
			const cellValue = Math.min(deletionCost, insertionCost, substitutionCost);
			current[j] = cellValue;
			rowMin = Math.min(rowMin, cellValue);
		}

		if (rowMin > maxDistance) {
			return maxDistance + 1;
		}

		[previous, current] = [current, previous];
	}

	return previous[targetLength]!;
};

export enum AutocompleteMatchQuality {
	exact = 0,
	prefix = 1,
	wordBoundary = 2,
	fuzzy = 3,
}

export interface IAutocompleteMatch {
	quality: AutocompleteMatchQuality;
	distance: number;
}

const WORD_BOUNDARY_REGEX = /[\s\p{P}]+/u;

const getWordBoundaryMatch = (normalizedName: string, normalizedQuery: string, originalName: string): boolean => {
	// Check if query matches the start of any word in the original (un-normalized) name.
	// We split the original name to find word boundaries, then normalize each word.
	const words = originalName.split(WORD_BOUNDARY_REGEX);
	for (const word of words) {
		if (word.length === 0) {
			continue;
		}

		const normalizedWord = normalizeNameForSearch(word);
		if (normalizedWord.startsWith(normalizedQuery)) {
			return true;
		}
	}

	return false;
};

const getMaxEditDistance = (queryLength: number): number => {
	if (queryLength >= 7) {
		return 2;
	}
	if (queryLength >= 5) {
		return 1;
	}
	return 0;
};

export const matchAutocomplete = (normalizedName: string, normalizedQuery: string, originalName: string): IAutocompleteMatch | null => {
	if (normalizedName === normalizedQuery) {
		return { quality: AutocompleteMatchQuality.exact, distance: 0 };
	}

	if (normalizedName.startsWith(normalizedQuery)) {
		return { quality: AutocompleteMatchQuality.prefix, distance: 0 };
	}

	if (getWordBoundaryMatch(normalizedName, normalizedQuery, originalName)) {
		return { quality: AutocompleteMatchQuality.wordBoundary, distance: 0 };
	}

	const maxDistance = getMaxEditDistance(normalizedQuery.length);
	if (maxDistance > 0) {
		// Check fuzzy prefix: compare query against the first N characters of the name
		const namePrefix = normalizedName.slice(0, normalizedQuery.length + maxDistance);
		const distance = boundedLevenshtein(normalizedQuery, namePrefix, maxDistance);
		if (distance <= maxDistance) {
			return { quality: AutocompleteMatchQuality.fuzzy, distance };
		}
	}

	return null;
};
