import { ISearchQuery, SearchEntityType } from '@msdining/common/models/search';
import { IQuerySearchResult } from '../../models/search.ts';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';

export class FavoritesCache {
    // entity type -> normalized name -> entity
    private _cacheByEntityType = new Map<SearchEntityType, Map<string, IQuerySearchResult>>();

    private _getResultsByNameForEntityType(type: SearchEntityType) {
        if (type == null) {
            throw new Error('Query must have an entity type set');
        }

        if (!this._cacheByEntityType.has(type)) {
            this._cacheByEntityType.set(type, new Map());
        }

        return this._cacheByEntityType.get(type)!;
    }

    public get(query: ISearchQuery) {
        if (query.type == null) {
            throw new Error('Query must have an entity type set');
        }

        const resultsByName = this._getResultsByNameForEntityType(query.type);
        return resultsByName.get(query.text);
    }

    public addToCache(result: IQuerySearchResult) {
        const resultsByName = this._getResultsByNameForEntityType(result.entityType);

        const name = normalizeNameForSearch(result.name);
        resultsByName.set(name, result);
    }
}