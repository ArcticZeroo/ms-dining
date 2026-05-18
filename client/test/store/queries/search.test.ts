import { ISearchQuery, SearchEntityType } from '@msdining/common/models/search';
import * as assert from 'node:assert';
import { describe, it } from 'vitest';
import { searchQueryHash, searchQueryHashes } from '../../../src/store/queries/search.ts';

const query = (text: string, type?: SearchEntityType): ISearchQuery => ({ text, type });

describe('searchQueryHash', () => {
    it('defaults missing type to menuItem', () => {
        assert.strictEqual(
            searchQueryHash(query('burger')),
            searchQueryHash(query('burger', SearchEntityType.menuItem)),
        );
    });

    it('produces distinct hashes for different types of the same text', () => {
        assert.notStrictEqual(
            searchQueryHash(query('burger', SearchEntityType.menuItem)),
            searchQueryHash(query('burger', SearchEntityType.station)),
        );
    });

    it('encodes both type and text', () => {
        assert.strictEqual(searchQueryHash(query('burger', SearchEntityType.menuItem)), 'menuItem:burger');
    });
});

describe('searchQueryHashes', () => {
    it('is stable across input order', () => {
        const queries = [query('apple'), query('zebra'), query('mango')];
        const reordered = [query('zebra'), query('mango'), query('apple')];
        assert.deepStrictEqual(searchQueryHashes(queries), searchQueryHashes(reordered));
    });

    it('returns an empty array for an empty input', () => {
        assert.deepStrictEqual(searchQueryHashes([]), []);
    });
});
