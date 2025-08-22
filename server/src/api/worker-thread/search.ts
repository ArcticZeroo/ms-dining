import { SearchEntityType } from '@msdining/common/dist/models/search.js';
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

const COMMANDS = {
	insertSearchEmbedding: onInsertSearchEmbedding,
	insertQueryEmbedding: onInsertQueryEmbedding,
	getIsSearchEntityEmbedded: onGetIsSearchEntityEmbedded,
	getQueryEmbedding: onGetQueryEmbedding,
	getSearchResults: onGetSearchResults,
	getAllEmbeddedEntities: onGetAllEmbeddedEntities,
	getAllSearchQueries: onGetAllSearchQueries,
	getSearchEntityEmbedding: onGetSearchEntityEmbedding,
	getSimilarQueries: onGetSimilarQueries,
	clearDuplicatedQueries: onClearDuplicatedQueries,
};

export const SEARCH_THREAD_HANDLER = new WorkerThreadCommandHandler(new URL(import.meta.url), COMMANDS);