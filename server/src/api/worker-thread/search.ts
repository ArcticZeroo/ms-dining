import { SearchEntityType } from '@msdining/common/models/search';
import seedrandom from 'seedrandom';
import { IEntityRef } from '../../models/vector.js';
import * as db from '../storage/vector/db.js';
import { WorkerThreadCommandHandler } from './commanding.js';

const VECTOR_SEARCH_ITEM_LIMIT = 50;
const SIMILAR_QUERY_SEARCH_LIMIT = 5;

interface IInsertSearchEmbeddingRequestData {
	entityType: SearchEntityType;
	id: string;
	embedding: Float32Array;
}

const onInsertSearchEmbedding = async ({ entityType, id, embedding }: IInsertSearchEmbeddingRequestData) => {
    db.insertSearchEntityEmbedding(embedding, id, entityType);
}

const onInsertQueryEmbedding = async ({ embedding, query }: { embedding: Float32Array, query: string }) => {
    db.insertQueryEmbedding(embedding, query);
}

const onGetIsSearchEntityEmbedded = async ({ entityType, id }: { entityType: SearchEntityType, id: string }) => {
    return db.isEmbeddedEntity(entityType, id);
}

const onGetQueryEmbedding = async (query: string) => {
    return db.getQueryEmbedding(query);
}

const onGetSearchResults = async ({ query }: { query: Float32Array }) => {
    return db.searchVectorRaw(query, VECTOR_SEARCH_ITEM_LIMIT);
}

const onGetSearchResultsByType = async ({ query, entityType, limit }: { query: Float32Array, entityType: SearchEntityType, limit: number }) => {
    return db.searchVectorRawByType(query, entityType, limit);
}

const onGetAllEmbeddedEntities = async () => {
    return db.getAllEmbeddedEntities();
}

const onGetAllSearchQueries = async () => {
    return db.getAllSearchQueries();
}

const onGetSearchEntityEmbedding = async ({ entityType, id }: { entityType: SearchEntityType, id: string }) => {
    return db.getSearchEntityEmbedding(entityType, id);
}

const onGetSimilarQueries = async ({ query, queryEmbedding }: { query: string, queryEmbedding: Float32Array }) => {
    return db.searchForSimilarQueries(queryEmbedding, query, SIMILAR_QUERY_SEARCH_LIMIT);
}

const onClearDuplicatedQueries = async () => {
    return db.clearDuplicatedQueries();
}

const onDeleteSearchEmbedding = async ({ entityType, id }: { entityType: SearchEntityType, id: string }) => {
    db.deleteSearchEntityEmbedding(entityType, id);
}

const onGetAllEmbeddedIdsByType = async (entityType: SearchEntityType) => {
    return db.getAllEmbeddedIdsByType(entityType);
}

const onDeleteAllByEntityType = async (entityType: SearchEntityType) => {
    db.deleteAllByEntityType(entityType);
}

interface ISearchSimilarByEntityIdRequest {
	entityType: SearchEntityType;
	id: string;
	limit: number;
}

const onSearchSimilarByEntityId = async ({ entityType, id, limit }: ISearchSimilarByEntityIdRequest) => {
    return db.searchSimilarByEntityId(entityType, id, limit);
}

interface IComputeCentroidSearchRequest {
	entities: Array<IEntityRef>;
	searchEntityType: SearchEntityType;
	limit: number;
}

const onComputeCentroidSearch = async ({ entities, searchEntityType, limit }: IComputeCentroidSearchRequest) => {
    return db.computeCentroidAndSearch(entities, searchEntityType, limit);
}

interface IComputeNegativePenaltiesRequest {
	candidateIds: string[];
	negativeEntities: Array<IEntityRef>;
	candidateEntityType: SearchEntityType;
}

const onComputeNegativePenalties = async ({ candidateIds, negativeEntities, candidateEntityType }: IComputeNegativePenaltiesRequest) => {
    return db.computeNegativePenalties(candidateIds, negativeEntities, candidateEntityType);
}

interface ISortByEmbeddingDiversityRequest {
	candidateIds: string[];
	entityType: SearchEntityType;
	scores: number[];
	lambda: number;
	seed: string;
}

const onSortByEmbeddingDiversity = async ({ candidateIds, entityType, scores, lambda, seed }: ISortByEmbeddingDiversityRequest) => {
    return db.sortByEmbeddingDiversity(candidateIds, entityType, scores, lambda, seedrandom(seed));
}

interface IDiverseWeightedSampleRequest {
	entityIds: string[];
	entityType: SearchEntityType;
	weights: number[];
	count: number;
	seed: string;
}

const onDiverseWeightedSample = async ({ entityIds, entityType, weights, count, seed }: IDiverseWeightedSampleRequest) => {
    return db.diverseWeightedSample(entityIds, entityType, weights, count, seedrandom(seed));
}

const COMMANDS = {
    insertSearchEmbedding: onInsertSearchEmbedding,
    insertQueryEmbedding: onInsertQueryEmbedding,
    getIsSearchEntityEmbedded: onGetIsSearchEntityEmbedded,
    getQueryEmbedding: onGetQueryEmbedding,
    getSearchResults: onGetSearchResults,
    getSearchResultsByType: onGetSearchResultsByType,
    getAllEmbeddedEntities: onGetAllEmbeddedEntities,
    getAllSearchQueries: onGetAllSearchQueries,
    getSearchEntityEmbedding: onGetSearchEntityEmbedding,
    getSimilarQueries: onGetSimilarQueries,
    clearDuplicatedQueries: onClearDuplicatedQueries,
    deleteSearchEmbedding: onDeleteSearchEmbedding,
    getAllEmbeddedIdsByType: onGetAllEmbeddedIdsByType,
    deleteAllByEntityType: onDeleteAllByEntityType,
    searchSimilarByEntityId: onSearchSimilarByEntityId,
    computeCentroidSearch: onComputeCentroidSearch,
    computeNegativePenalties: onComputeNegativePenalties,
    sortByEmbeddingDiversity: onSortByEmbeddingDiversity,
    diverseWeightedSample: onDiverseWeightedSample,
};

export const SEARCH_THREAD_HANDLER = new WorkerThreadCommandHandler(new URL(import.meta.url), COMMANDS);