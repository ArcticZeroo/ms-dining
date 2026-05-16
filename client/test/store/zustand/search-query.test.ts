import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'vitest';
import { setSearchQuery, useSearchQueryStore } from '../../../src/store/zustand/search-query.js';

const reset = () => useSearchQueryStore.setState({ query: '' });

describe('useSearchQueryStore', () => {
    afterEach(reset);

    it('starts empty', () => {
        reset();
        assert.equal(useSearchQueryStore.getState().query, '');
    });

    it('setQuery writes the new value', () => {
        useSearchQueryStore.getState().setQuery('pizza');
        assert.equal(useSearchQueryStore.getState().query, 'pizza');
    });

    it('setSearchQuery helper updates the store', () => {
        setSearchQuery('burger');
        assert.equal(useSearchQueryStore.getState().query, 'burger');
    });
});
