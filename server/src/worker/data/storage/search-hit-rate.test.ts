import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldPromoteByHitRate, getAverageDistance } from './search-hit-rate.js';

describe('shouldPromoteByHitRate', () => {
    it('returns false for empty station', () => {
        assert.equal(shouldPromoteByHitRate({ matchedCount: 0, totalCount: 0, distanceCount: 0, totalDistance: 0 }), false);
    });

    it('returns false when matched count is below minimum (1 of 1)', () => {
        assert.equal(shouldPromoteByHitRate({ matchedCount: 1, totalCount: 1, distanceCount: 1, totalDistance: 0.5 }), false);
    });

    it('promotes when hit rate >= 0.5 and matched count >= 2', () => {
        // 5 of 10 = 0.5
        assert.equal(shouldPromoteByHitRate({ matchedCount: 5, totalCount: 10, distanceCount: 5, totalDistance: 2.5 }), true);
        // 2 of 4 = 0.5
        assert.equal(shouldPromoteByHitRate({ matchedCount: 2, totalCount: 4, distanceCount: 2, totalDistance: 1.0 }), true);
    });

    it('promotes when hit rate >= 0.15 and matched count >= 3', () => {
        // 3 of 20 = 0.15
        assert.equal(shouldPromoteByHitRate({ matchedCount: 3, totalCount: 20, distanceCount: 3, totalDistance: 1.5 }), true);
        // 4 of 20 = 0.2
        assert.equal(shouldPromoteByHitRate({ matchedCount: 4, totalCount: 20, distanceCount: 4, totalDistance: 2.0 }), true);
    });

    it('does not promote when hit rate is below 0.15', () => {
        // 2 of 200 = 0.01 (e.g. burger at Food Hall)
        assert.equal(shouldPromoteByHitRate({ matchedCount: 2, totalCount: 200, distanceCount: 2, totalDistance: 1.0 }), false);
    });

    it('does not promote when hit rate is between 0.15-0.5 but count < 3', () => {
        // 2 of 10 = 0.2 but only 2 matched items
        assert.equal(shouldPromoteByHitRate({ matchedCount: 2, totalCount: 10, distanceCount: 2, totalDistance: 1.0 }), false);
    });

    it('promotes Dote-like scenario: all items match', () => {
        // 15 of 15 = 1.0
        assert.equal(shouldPromoteByHitRate({ matchedCount: 15, totalCount: 15, distanceCount: 15, totalDistance: 7.5 }), true);
    });

    it('does not promote Food-Hall-like scenario: tiny fraction matches', () => {
        // 3 of 200 = 0.015
        assert.equal(shouldPromoteByHitRate({ matchedCount: 3, totalCount: 200, distanceCount: 3, totalDistance: 1.5 }), false);
    });
});

describe('getAverageDistance', () => {
    it('returns undefined when no items had a vector distance', () => {
        assert.equal(getAverageDistance({ matchedCount: 5, totalCount: 10, distanceCount: 0, totalDistance: 0 }), undefined);
    });

    it('returns average of only the items with vector distances', () => {
        // 3 items matched, but only 2 had vector distances
        assert.equal(getAverageDistance({ matchedCount: 3, totalCount: 10, distanceCount: 2, totalDistance: 1.0 }), 0.5);
    });

    it('returns exact distance for single match', () => {
        assert.equal(getAverageDistance({ matchedCount: 1, totalCount: 5, distanceCount: 1, totalDistance: 0.3 }), 0.3);
    });
});