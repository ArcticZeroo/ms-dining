import * as assert from 'node:assert';
import { describe, it } from 'vitest';
import { aggregateCartEstimates } from '../../../src/store/queries/ordering.ts';

describe('aggregateCartEstimates', () => {
    const estimate = (subtotal: number, tax: number, total: number, minTime = 5, maxTime = 10) =>
        ({ waitTime: { minTime, maxTime }, subtotal, tax, total });

    it('returns no data and not loading for an empty cart', () => {
        const result = aggregateCartEstimates([]);
        assert.strictEqual(result.data, undefined);
        assert.strictEqual(result.isLoading, false);
    });

    it('sums pricing and takes the max wait time once every cafe has loaded', () => {
        const result = aggregateCartEstimates([
            { data: estimate(10, 1, 11, 5, 8), isLoading: false },
            { data: estimate(20, 2, 22, 7, 15), isLoading: false },
        ]);
        assert.ok(result.data);
        assert.strictEqual(result.data.subtotal, 30);
        assert.strictEqual(result.data.tax, 3);
        assert.strictEqual(result.data.total, 33);
        assert.strictEqual(result.data.waitTime.minTime, 7);
        assert.strictEqual(result.data.waitTime.maxTime, 15);
        assert.strictEqual(result.isLoading, false);
    });

    it('does NOT return a partial total while one cafe is still loading', () => {
        // One cafe loaded, one still loading. The old code returned the partial
        // sum (11) as if final; the fix reports no data + loading instead.
        const result = aggregateCartEstimates([
            { data: estimate(10, 1, 11), isLoading: false },
            { data: undefined, isLoading: true },
        ]);
        assert.strictEqual(result.data, undefined);
        assert.strictEqual(result.isLoading, true);
    });

    it('reports loading when no cafe has loaded yet', () => {
        const result = aggregateCartEstimates([
            { data: undefined, isLoading: true },
        ]);
        assert.strictEqual(result.data, undefined);
        assert.strictEqual(result.isLoading, true);
    });

    it('reports no data without loading when a cafe is missing data but not actively loading (e.g. disabled)', () => {
        const result = aggregateCartEstimates([
            { data: estimate(10, 1, 11), isLoading: false },
            { data: undefined, isLoading: false },
        ]);
        assert.strictEqual(result.data, undefined);
        assert.strictEqual(result.isLoading, false);
    });
});
