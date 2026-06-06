import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
    getOrderHistoryBoostMultiplier,
    getReviewPopularityMultiplier,
    REVIEW_RATING_AMPLITUDE,
} from '../../util/recommendation-ranking.js';

describe('getOrderHistoryBoostMultiplier', () => {
    it('returns 1 for non-positive counts', () => {
        assert.equal(getOrderHistoryBoostMultiplier(0), 1);
        assert.equal(getOrderHistoryBoostMultiplier(-5), 1);
    });

    it('grows monotonically with count', () => {
        const at1 = getOrderHistoryBoostMultiplier(1);
        const at3 = getOrderHistoryBoostMultiplier(3);
        const at10 = getOrderHistoryBoostMultiplier(10);
        assert.ok(at1 > 1);
        assert.ok(at3 > at1);
        assert.ok(at10 > at3);
    });

    it('matches the documented empirical shape within a small tolerance', () => {
        assert.ok(Math.abs(getOrderHistoryBoostMultiplier(1) - 1.207944) < 1e-4);
        assert.ok(Math.abs(getOrderHistoryBoostMultiplier(3) - 1.415888) < 1e-4);
        assert.ok(Math.abs(getOrderHistoryBoostMultiplier(10) - 1.719315) < 1e-4);
    });
});

describe('getReviewPopularityMultiplier', () => {
    it('returns 1 when there are no reviews', () => {
        assert.equal(getReviewPopularityMultiplier(0, 0), 1);
        assert.equal(getReviewPopularityMultiplier(10, 0), 1);
        assert.equal(getReviewPopularityMultiplier(5, 0), 1);
    });

    it('returns 1 at the neutral rating regardless of review count', () => {
        assert.equal(getReviewPopularityMultiplier(5, 1), 1);
        assert.equal(getReviewPopularityMultiplier(5, 100), 1);
        assert.equal(getReviewPopularityMultiplier(5, 1000), 1);
    });

    it('boosts above 1 for above-neutral ratings', () => {
        assert.ok(getReviewPopularityMultiplier(7, 10) > 1);
        assert.ok(getReviewPopularityMultiplier(10, 100) > 1);
    });

    it('demotes below 1 for below-neutral ratings', () => {
        assert.ok(getReviewPopularityMultiplier(3, 10) < 1);
        assert.ok(getReviewPopularityMultiplier(0, 100) < 1);
    });

    it('boost and demote are symmetric for symmetric ratings', () => {
        const boost = getReviewPopularityMultiplier(7, 50) - 1;
        const demote = 1 - getReviewPopularityMultiplier(3, 50);
        assert.ok(Math.abs(boost - demote) < 1e-9);
    });

    it('caps at 1 ± amplitude for perfect/zero ratings at high review counts', () => {
        assert.ok(Math.abs(getReviewPopularityMultiplier(10, 100) - (1 + REVIEW_RATING_AMPLITUDE)) < 1e-9);
        assert.ok(Math.abs(getReviewPopularityMultiplier(0, 100) - (1 - REVIEW_RATING_AMPLITUDE)) < 1e-9);
        // Beyond the reference count, confidence stays capped at 1.
        assert.ok(Math.abs(getReviewPopularityMultiplier(10, 1000) - (1 + REVIEW_RATING_AMPLITUDE)) < 1e-9);
    });

    it('gives only a small nudge for a single review even at perfect rating', () => {
        const multiplier = getReviewPopularityMultiplier(10, 1);
        assert.ok(multiplier > 1);
        assert.ok(multiplier - 1 < 0.1, `expected small nudge for a single review, got ${multiplier}`);
    });
});
