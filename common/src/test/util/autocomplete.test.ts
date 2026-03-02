import {
	normalizeForAutocomplete,
	boundedLevenshtein,
	matchAutocomplete,
	AutocompleteMatchQuality
} from '../../util/autocomplete.js';
import { normalizeNameForSearch } from '../../util/search-util.js';
import { describe, it } from 'node:test';
import * as assert from 'node:assert';

describe('autocomplete', () => {
	describe('normalizeForAutocomplete (deprecated, still tested for compat)', () => {
		it('should lowercase text', () => {
			assert.equal(normalizeForAutocomplete('HELLO'), 'hello');
		});

		it('should strip accents', () => {
			assert.equal(normalizeForAutocomplete('café'), 'cafe');
		});
	});

	describe('matchAutocomplete (using normalizeNameForSearch)', () => {
		it('should return exact match when normalized name equals query', () => {
			const normalized = normalizeNameForSearch('Shawarma');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('shawarma'), 'Shawarma');
			assert.notEqual(result, null);
			assert.equal(result!.quality, AutocompleteMatchQuality.exact);
			assert.equal(result!.distance, 0);
		});

		it('should return prefix match when name starts with query', () => {
			const normalized = normalizeNameForSearch('Chicken Shawarma');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('chicken'), 'Chicken Shawarma');
			assert.notEqual(result, null);
			assert.equal(result!.quality, AutocompleteMatchQuality.prefix);
			assert.equal(result!.distance, 0);
		});

		it('should return word boundary match for "shawarma" in "Chicken Shawarma Bowl"', () => {
			const normalized = normalizeNameForSearch('Chicken Shawarma Bowl');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('shawarma'), 'Chicken Shawarma Bowl');
			assert.notEqual(result, null);
			assert.equal(result!.quality, AutocompleteMatchQuality.wordBoundary);
			assert.equal(result!.distance, 0);
		});

		it('should return word boundary match for "shawarma" in "Chicken Shawarma Wrap"', () => {
			const normalized = normalizeNameForSearch('Chicken Shawarma Wrap');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('shawarma'), 'Chicken Shawarma Wrap');
			assert.notEqual(result, null);
			assert.equal(result!.quality, AutocompleteMatchQuality.wordBoundary);
		});

		it('should return word boundary match for "shawarma" in "Chicken Shawarma Salad"', () => {
			const normalized = normalizeNameForSearch('Chicken Shawarma Salad');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('shawarma'), 'Chicken Shawarma Salad');
			assert.notEqual(result, null);
			assert.equal(result!.quality, AutocompleteMatchQuality.wordBoundary);
		});

		it('should return word boundary match for "shawarma" in "Halal Chicken Shawarma Plate"', () => {
			const normalized = normalizeNameForSearch('Halal Chicken Shawarma Plate');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('shawarma'), 'Halal Chicken Shawarma Plate');
			assert.notEqual(result, null);
			assert.equal(result!.quality, AutocompleteMatchQuality.wordBoundary);
		});

		it('should match word boundaries with punctuation in name', () => {
			const normalized = normalizeNameForSearch('Lamb + Beef Wrap');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('beef'), 'Lamb + Beef Wrap');
			assert.notEqual(result, null);
			assert.equal(result!.quality, AutocompleteMatchQuality.wordBoundary);
		});

		it('should return fuzzy match for query >= 5 chars with distance 1', () => {
			const normalized = normalizeNameForSearch('Shawarma');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('shawrma'), 'Shawarma');
			assert.notEqual(result, null);
			assert.equal(result!.quality, AutocompleteMatchQuality.fuzzy);
			assert.ok(result!.distance <= 1);
		});

		it('should return fuzzy match for query >= 7 chars with distance 2', () => {
			const normalized = normalizeNameForSearch('Shawarma');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('shawerma'), 'Shawarma');
			assert.notEqual(result, null);
			assert.equal(result!.quality, AutocompleteMatchQuality.fuzzy);
		});

		it('should not fuzzy match for query < 5 chars', () => {
			const normalized = normalizeNameForSearch('Cat');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('catt'), 'Cat');
			assert.equal(result, null);
		});

		it('should return null when nothing matches', () => {
			const normalized = normalizeNameForSearch('Chicken Shawarma Bowl');
			const result = matchAutocomplete(normalized, normalizeNameForSearch('pizza'), 'Chicken Shawarma Bowl');
			assert.equal(result, null);
		});

		it('should prefer exact over prefix', () => {
			const exact = matchAutocomplete(normalizeNameForSearch('Chicken'), normalizeNameForSearch('chicken'), 'Chicken');
			const prefix = matchAutocomplete(normalizeNameForSearch('Chicken Tinga'), normalizeNameForSearch('chicken'), 'Chicken Tinga');
			assert.ok(exact!.quality < prefix!.quality);
		});

		it('should prefer prefix over word boundary', () => {
			const prefix = matchAutocomplete(normalizeNameForSearch('Chicken Tinga'), normalizeNameForSearch('chicken'), 'Chicken Tinga');
			const wordBoundary = matchAutocomplete(normalizeNameForSearch('Spicy Chicken'), normalizeNameForSearch('chicken'), 'Spicy Chicken');
			assert.ok(prefix!.quality < wordBoundary!.quality);
		});

		it('should prefer word boundary over fuzzy', () => {
			const wordBoundary = matchAutocomplete(normalizeNameForSearch('Chicken Shawarma Bowl'), normalizeNameForSearch('shawarma'), 'Chicken Shawarma Bowl');
			const fuzzy = matchAutocomplete(normalizeNameForSearch('Shawarma'), normalizeNameForSearch('shawrma'), 'Shawarma');
			assert.ok(wordBoundary!.quality < fuzzy!.quality);
		});
	});

	describe('boundedLevenshtein', () => {
		it('should return 0 for identical strings', () => {
			assert.equal(boundedLevenshtein('hello', 'hello', 2), 0);
		});

		it('should return correct distance for single substitution', () => {
			assert.equal(boundedLevenshtein('cat', 'car', 2), 1);
		});

		it('should return correct distance for single insertion', () => {
			assert.equal(boundedLevenshtein('cat', 'cats', 2), 1);
		});

		it('should return correct distance for single deletion', () => {
			assert.equal(boundedLevenshtein('cats', 'cat', 2), 1);
		});

		it('should return distance within max', () => {
			assert.equal(boundedLevenshtein('kitten', 'sittin', 2), 2);
		});

		it('should return maxDistance + 1 when distance exceeds max', () => {
			assert.equal(boundedLevenshtein('abc', 'xyz', 2), 3);
		});

		it('should bail early when length difference exceeds maxDistance', () => {
			assert.equal(boundedLevenshtein('a', 'abcd', 2), 3);
		});
	});
});
