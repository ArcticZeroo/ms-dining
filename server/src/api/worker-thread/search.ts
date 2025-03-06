import { SearchEntityType } from '@msdining/common/dist/models/search.js';
import {
	getAllEmbeddedItems,
	getQueryEmbedding,
	insertQueryEmbedding,
	insertSearchEntityEmbedding,
	isEmbeddedEntity,
	searchVectorRaw
} from '../storage/vector/db.js';
import { WorkerThreadCommandHandler } from './commanding.js';

const VECTOR_SEARCH_ITEM_LIMIT = 50;

interface IInsertSearchEmbeddingRequestData {
	entityType: SearchEntityType;
	id: string;
	embedding: Float32Array;
}

const onInsertSearchEmbedding = async ({ entityType, id, embedding }: IInsertSearchEmbeddingRequestData) => {
	insertSearchEntityEmbedding(embedding, id, entityType);
}

const onInsertQueryEmbedding = async ({ embedding, query }: { embedding: Float32Array, query: string }) => {
	insertQueryEmbedding(embedding, query);
}

const onGetIsSearchEntityEmbedded = async ({ entityType, id }: { entityType: SearchEntityType, id: string }) => {
	return isEmbeddedEntity(entityType, id);
}

const onGetQueryEmbedding = async (query: string) => {
	return getQueryEmbedding(query);
}

const onGetSearchResults = async (query: Float32Array) => {
	return searchVectorRaw(query, VECTOR_SEARCH_ITEM_LIMIT);
}

const onGetAllEmbeddedEntities = async () => {
	return getAllEmbeddedItems();
}

const COMMANDS = {
	insertSearchEmbedding: onInsertSearchEmbedding,
	insertQueryEmbedding: onInsertQueryEmbedding,
	getIsSearchEntityEmbedded: onGetIsSearchEntityEmbedded,
	getQueryEmbedding: onGetQueryEmbedding,
	getSearchResults: onGetSearchResults,
	getAllEmbeddedEntities: onGetAllEmbeddedEntities
};

export const SEARCH_THREAD_HANDLER = new WorkerThreadCommandHandler(new URL(import.meta.url), COMMANDS);