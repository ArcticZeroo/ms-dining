import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	toRecommendationItem,
	deduplicateItems,
	computePopularityScore,
	IMenuItemCandidate,
} from '../../util/recommendation.js';
import { RecommendationSectionType } from '@msdining/common/models/recommendation';
import { IMenuItemBase } from '@msdining/common/models/cafe';

const makeMenuItem = (overrides: Partial<IMenuItemBase> = {}): IMenuItemBase => ({
	id:          'item-1',
	name:        'Test Item',
	cafeId:      'cafe-1',
	stationId:   'station-1',
	price:       5.99,
	calories:    300,
	maxCalories: 300,
	hasThumbnail: false,
	modifiers:   [],
	tags:        new Set(),
	searchTags:  new Set(),
	...overrides,
});

const makeAvailable = (overrides: Partial<IMenuItemCandidate> = {}): IMenuItemCandidate => ({
	menuItem:    makeMenuItem(),
	cafeId:      'cafe-1',
	cafeName:    'Test Cafe',
	stationName: 'Test Station',
	...overrides,
});

describe('toRecommendationItem', () => {
	it('maps available menu item fields correctly', () => {
		const item = makeAvailable({
			menuItem: makeMenuItem({ id: 'burger-1', name: 'Cheeseburger', price: 8.50, calories: 650 }),
			cafeId: 'cafe-a',
			cafeName: 'Cafe Alpha',
			stationName: 'Grill',
		});

		const result = toRecommendationItem(item, 0.85, 'Popular');

		assert.equal(result.menuItemId, 'burger-1');
		assert.equal(result.name, 'Cheeseburger');
		assert.equal(result.price, 8.50);
		assert.equal(result.calories, 650);
		assert.equal(result.cafeId, 'cafe-a');
		assert.equal(result.cafeName, 'Cafe Alpha');
		assert.equal(result.stationName, 'Grill');
		assert.equal(result.score, 0.85);
		assert.equal(result.reason, 'Popular');
	});

	it('converts tags from Set to Array', () => {
		const item = makeAvailable({
			menuItem: makeMenuItem({ tags: new Set(['vegan', 'gluten-free']) }),
		});

		const result = toRecommendationItem(item, 1);
		assert.ok(result.tags);
		assert.equal(result.tags.length, 2);
		assert.ok(result.tags.includes('vegan'));
		assert.ok(result.tags.includes('gluten-free'));
	});

	it('returns undefined tags when set is empty', () => {
		const item = makeAvailable({
			menuItem: makeMenuItem({ tags: new Set() }),
		});

		const result = toRecommendationItem(item, 1);
		assert.equal(result.tags, undefined);
	});

	it('converts null description/imageUrl to undefined', () => {
		const item = makeAvailable({
			menuItem: makeMenuItem({ description: null, imageUrl: null }),
		});

		const result = toRecommendationItem(item, 1);
		assert.equal(result.description, undefined);
		assert.equal(result.imageUrl, undefined);
	});
});

describe('deduplicateItems', () => {
	const makeSection = (type: RecommendationSectionType, items: Array<{ name: string }>) => ({
		type,
		title: type,
		items: items.map(({ name }) => toRecommendationItem(
			makeAvailable({ menuItem: makeMenuItem({ name }) }),
			1,
		)),
	});

	it('removes duplicate items across sections, keeping first occurrence', () => {
		const sections = [
			makeSection(RecommendationSectionType.newAtFavorites, [{ name: 'Burger' }, { name: 'Salad' }]),
			makeSection(RecommendationSectionType.popular, [{ name: 'Burger' }, { name: 'Soup' }]),
		];

		const result = deduplicateItems(sections);
		assert.equal(result.length, 2);
		assert.equal(result[0]!.items.length, 2); // Burger + Salad
		assert.equal(result[1]!.items.length, 1); // Soup only (Burger deduped)
		assert.equal(result[1]!.items[0]!.name, 'Soup');
	});

	it('removes sections that become empty after deduplication', () => {
		const sections = [
			makeSection(RecommendationSectionType.newAtFavorites, [{ name: 'Burger' }]),
			makeSection(RecommendationSectionType.popular, [{ name: 'Burger' }]),
		];

		const result = deduplicateItems(sections);
		assert.equal(result.length, 1);
		assert.equal(result[0]!.type, RecommendationSectionType.newAtFavorites);
	});

	it('treats items with same normalized name as duplicates', () => {
		const sections = [
			makeSection(RecommendationSectionType.newAtFavorites, [{ name: 'The Burger' }]),
			makeSection(RecommendationSectionType.popular, [{ name: 'the burger' }]),
		];

		const result = deduplicateItems(sections);
		assert.equal(result.length, 1);
	});

	it('returns empty array when all sections are empty', () => {
		const result = deduplicateItems([]);
		assert.equal(result.length, 0);
	});

	it('preserves sections with no overlapping items', () => {
		const sections = [
			makeSection(RecommendationSectionType.newAtFavorites, [{ name: 'Burger' }]),
			makeSection(RecommendationSectionType.popular, [{ name: 'Salad' }]),
			makeSection(RecommendationSectionType.trySomethingDifferent, [{ name: 'Soup' }]),
		];

		const result = deduplicateItems(sections);
		assert.equal(result.length, 3);
		assert.equal(result[0]!.items.length, 1);
		assert.equal(result[1]!.items.length, 1);
		assert.equal(result[2]!.items.length, 1);
	});
});

describe('computePopularityScore', () => {
	it('returns 0 for zero rating and zero reviews', () => {
		const score = computePopularityScore(0, 0);
		// log(0 + 1) * 0.4 = 0
		assert.equal(score, 0);
	});

	it('returns higher score for higher rating', () => {
		const low = computePopularityScore(3, 5);
		const high = computePopularityScore(9, 5);
		assert.ok(high > low);
	});

	it('returns higher score for more reviews at same rating', () => {
		const few = computePopularityScore(7, 2);
		const many = computePopularityScore(7, 50);
		assert.ok(many > few);
	});

	it('uses logarithmic scaling for review count', () => {
		// Adding 10 reviews at different baselines: diminishing marginal return
		const from0 = computePopularityScore(7, 10) - computePopularityScore(7, 0);
		const from50 = computePopularityScore(7, 60) - computePopularityScore(7, 50);
		assert.ok(from50 < from0);
	});

	it('perfect score is computed correctly', () => {
		// rating=10, count=100: (10/10)*0.6 + log(101)*0.4
		const score = computePopularityScore(10, 100);
		const expected = (10 / 10) * 0.6 + Math.log(101) * 0.4;
		assert.ok(Math.abs(score - expected) < 0.001);
	});
});
