import { normalizeNameForSearch } from '../../util/search-util.js';
import { describe, it } from 'node:test';
import * as assert from 'node:assert';

describe('normalizeNameForSearch', () => {
	it('should lowercase text', () => {
		assert.equal(normalizeNameForSearch('HELLO'), 'hello');
		assert.equal(normalizeNameForSearch('Chicken Shawarma'), 'chickenshawarma');
	});

	it('should strip accents', () => {
		assert.equal(normalizeNameForSearch('café'), 'cafe');
		assert.equal(normalizeNameForSearch('naïve'), 'naive');
		assert.equal(normalizeNameForSearch('résumé'), 'resume');
		assert.equal(normalizeNameForSearch('Crème Brûlée'), 'cremebrulee');
	});

	it('should remove whitespace', () => {
		assert.equal(normalizeNameForSearch('hello world'), 'helloworld');
		assert.equal(normalizeNameForSearch('  spaces  '), 'spaces');
		assert.equal(normalizeNameForSearch('Chicken Shawarma Bowl'), 'chickenshawarmabowl');
	});

	it('should remove punctuation and symbols', () => {
		assert.equal(normalizeNameForSearch("it's"), 'its');
		assert.equal(normalizeNameForSearch('mac & cheese'), 'maccheese');
		assert.equal(normalizeNameForSearch('lamb + beef'), 'lambbeef');
		assert.equal(normalizeNameForSearch('100% beef'), '100beef');
	});

	it('should strip the word "and" when surrounded by spaces', () => {
		assert.equal(normalizeNameForSearch('Mac and Cheese'), 'maccheese');
		assert.equal(normalizeNameForSearch('Chicken and Waffles'), 'chickenwaffles');
	});

	it('should not strip "and" when part of another word', () => {
		assert.equal(normalizeNameForSearch('Sandcastle'), 'sandcastle');
		assert.equal(normalizeNameForSearch('Candy'), 'candy');
	});

	it('should strip leading "the"', () => {
		assert.equal(normalizeNameForSearch('The Grill'), 'grill');
		assert.equal(normalizeNameForSearch('the grill'), 'grill');
	});

	it('should not strip "the" when not leading', () => {
		assert.equal(normalizeNameForSearch('On the Grill'), 'onthegrill');
	});

	it('should handle combined normalization', () => {
		assert.equal(normalizeNameForSearch('Halal Chicken Shawarma Plate'), 'halalchickenshawarmaplate');
		assert.equal(normalizeNameForSearch('Lamb + Beef Wrap'), 'lambbeefwrap');
		assert.equal(normalizeNameForSearch('Chipotle Chicken and Bacon Sub'), 'chipotlechickenbaconsub');
	});

	it('should make equivalent names match each other', () => {
		const variants = [
			'Mac & Cheese',
			'Mac + Cheese',
			'Mac and Cheese',
		];
		const normalized = variants.map(normalizeNameForSearch);
		assert.equal(normalized[0], normalized[1]);
		assert.equal(normalized[1], normalized[2]);
	});

	it('should return empty string for empty input', () => {
		assert.equal(normalizeNameForSearch(''), '');
	});

	it('should preserve numbers', () => {
		assert.equal(normalizeNameForSearch('3 Course Meal'), '3coursemeal');
		assert.equal(normalizeNameForSearch('Building 4'), 'building4');
	});
});
