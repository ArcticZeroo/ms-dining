import { SEARCH_THREAD_HANDLER } from '../../threads/search.js';
import {
    retrieveEmbeddings,
    retrieveMenuItemEmbeddings,
} from '../../embeddings.js';
import { IEntityRef, IVectorSearchResult } from '../../../../shared/models/vector.js';
import { type INegativePenaltyResult } from './db.js';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { SearchEntityType } from '@msdining/common/models/search';
import { Lock } from '@frozor/lock';

const QUERY_LOCK = new Lock();

const getQueryEmbedding = async (query: string): Promise<Float32Array> => {
    query = query.toLowerCase();

    return QUERY_LOCK.acquire(async () => {
        const existingEmbedding = await SEARCH_THREAD_HANDLER.sendRequest('search', 'getQueryEmbedding', query);

        if (existingEmbedding) {
            return existingEmbedding;
        }

        const embedding = new Float32Array(await retrieveEmbeddings(query));
        await SEARCH_THREAD_HANDLER.sendRequest('search', 'insertQueryEmbedding', { embedding, query });
        return embedding;
    });
}

export const searchVectorRawFromEmbedding = async (embedding: Float32Array): Promise<Array<IVectorSearchResult>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'getSearchResults', { query: embedding });
}

export const searchVectorRawByType = async (embedding: Float32Array, entityType: SearchEntityType, limit: number): Promise<Array<IVectorSearchResult>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'getSearchResultsByType', { query: embedding, entityType, limit });
}

export const searchVectorRawFromQuery = async (query: string): Promise<Array<IVectorSearchResult>> => {
    const embedding = await getQueryEmbedding(query);
    return searchVectorRawFromEmbedding(embedding);
}

export const isEmbeddedEntity = async (entityType: SearchEntityType, id: string): Promise<boolean> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'getIsSearchEntityEmbedded', { entityType, id });
}

export const getSearchEntityEmbedding = async (entityType: SearchEntityType, id: string): Promise<Float32Array | null> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'getSearchEntityEmbedding', { entityType, id });
}

export const searchSimilarEntities = async (entityType: SearchEntityType, id: string): Promise<Array<IVectorSearchResult>> => {
    const embedding = await getSearchEntityEmbedding(entityType, id);
    if (!embedding) {
        return [];
    }

    return searchVectorRawFromEmbedding(embedding);
}

export const searchSimilarEntitiesByType = async (entityType: SearchEntityType, id: string, limit: number): Promise<Array<IVectorSearchResult>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'searchSimilarByEntityId', {
        entityType,
        id,
        limit,
    });
}

export const embedMenuItem = async (menuItem: IMenuItemBase, categoryName: string, stationName: string) => {
    const embedding = await retrieveMenuItemEmbeddings(menuItem, categoryName, stationName);
    await SEARCH_THREAD_HANDLER.sendRequest('search', 'insertSearchEmbedding', {
        entityType: SearchEntityType.menuItem,
        id:         menuItem.id,
        embedding:  new Float32Array(embedding),
    });
}

export const deleteSearchEmbedding = async (entityType: SearchEntityType, id: string) => {
    await SEARCH_THREAD_HANDLER.sendRequest('search', 'deleteSearchEmbedding', { entityType, id });
}

export const getAllEmbeddedIdsByType = async (entityType: SearchEntityType): Promise<Set<string>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'getAllEmbeddedIdsByType', entityType);
}

export const deleteAllByEntityType = async (entityType: SearchEntityType) => {
    await SEARCH_THREAD_HANDLER.sendRequest('search', 'deleteAllByEntityType', entityType);
}

export const getAllExistingEmbeddings = async (): Promise<Map<SearchEntityType, Set<string>>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'getAllEmbeddedEntities');
}

export const getAllSearchQueries = async (): Promise<Set<string>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'getAllSearchQueries');
}

export const getSimilarQueries = async (query: string): Promise<Array<string>> => {
    const embedding = await getQueryEmbedding(query);
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'getSimilarQueries', {
        query,
        queryEmbedding: embedding
    });
}

export const computeCentroidSearch = async (entities: Array<IEntityRef>, searchEntityType: SearchEntityType, limit: number): Promise<Array<IVectorSearchResult>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'computeCentroidSearch', { entities, searchEntityType, limit });
}

export const computeNegativePenalties = async (candidateIds: string[], negativeEntities: Array<IEntityRef>, candidateEntityType: SearchEntityType): Promise<INegativePenaltyResult[]> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'computeNegativePenalties', { candidateIds, negativeEntities, candidateEntityType });
}

export { type INegativePenaltyResult } from './db.js';

export const sortByEmbeddingDiversity = async (candidateIds: string[], entityType: SearchEntityType, scores: number[], lambda: number, seed: string): Promise<string[]> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'sortByEmbeddingDiversity', { candidateIds, entityType, scores, lambda, seed });
}

export const diverseWeightedSample = async (entityIds: string[], entityType: SearchEntityType, weights: number[], count: number, seed: string): Promise<string[]> => {
    return SEARCH_THREAD_HANDLER.sendRequest('search', 'diverseWeightedSample', { entityIds, entityType, weights, count, seed });
}