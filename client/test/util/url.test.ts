import * as assert from 'node:assert';
import { describe, it } from 'vitest';
import { getSearchPageTarget, getSearchUrl } from '../../src/util/url.ts';
import { DebugSettings } from '../../src/constants/settings.ts';

const withMapPageSearch = <T>(enabled: boolean, run: () => T): T => {
    const original = DebugSettings.enableMapPageSearch.value;
    try {
        DebugSettings.enableMapPageSearch.value = enabled;
        return run();
    } finally {
        DebugSettings.enableMapPageSearch.value = original;
    }
};

describe('getSearchPageTarget', () => {
    it('targets the search page when map page search is disabled', () => {
        withMapPageSearch(false, () => {
            assert.strictEqual(getSearchPageTarget(), 'search');
        });
    });

    it('targets the map page when map page search is enabled', () => {
        withMapPageSearch(true, () => {
            assert.strictEqual(getSearchPageTarget(), 'map');
        });
    });
});

describe('getSearchUrl', () => {
    it('builds a /search url when map page search is disabled', () => {
        withMapPageSearch(false, () => {
            assert.strictEqual(getSearchUrl('cheese pizza'), '/search?q=cheese%20pizza');
        });
    });

    it('builds a /map url when map page search is enabled', () => {
        withMapPageSearch(true, () => {
            assert.strictEqual(getSearchUrl('cheese pizza'), '/map?q=cheese%20pizza');
        });
    });

    it('encodes special characters in the query', () => {
        withMapPageSearch(false, () => {
            assert.strictEqual(getSearchUrl('a&b=c'), '/search?q=a%26b%3Dc');
        });
    });
});
