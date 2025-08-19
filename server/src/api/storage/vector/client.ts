import { SEARCH_THREAD_HANDLER } from '../../worker-thread/search.js';
import { retrieveEmbeddings, retrieveMenuItemEmbeddings, retrieveStationEmbeddings, retrieveCafeEmbeddings } from '../../openai.js';
import { IVectorSearchResult } from '../../../models/vector.js';
import { IMenuItemBase } from '@msdining/common/dist/models/cafe.js';
import { SearchEntityType } from '@msdining/common/dist/models/search.js';
import { ICafeStation, ICafe } from '../../../models/cafe.js';
import { CAFE_GROUP_LIST } from '../../../constants/cafes.js';

const getQueryEmbedding = async (query: string): Promise<Float32Array> => {
	const existingEmbedding = await SEARCH_THREAD_HANDLER.sendRequest('getQueryEmbedding', query);

	if (existingEmbedding) {
		return existingEmbedding;
	}

	const embedding = new Float32Array(await retrieveEmbeddings(query));
	await SEARCH_THREAD_HANDLER.sendRequest('insertQueryEmbedding', { embedding, query });
	return embedding;
}

export const searchVectorRawFromEmbedding = async (embedding: Float32Array): Promise<Array<IVectorSearchResult>> => {
	return SEARCH_THREAD_HANDLER.sendRequest('getSearchResults', { query: embedding });
}

export const searchVectorRawFromQuery = async (query: string): Promise<Array<IVectorSearchResult>> => {
	const embedding = await getQueryEmbedding(query);
	return searchVectorRawFromEmbedding(embedding);
}

export const isEmbeddedEntity = async (entityType: SearchEntityType, id: string): Promise<boolean> => {
	return SEARCH_THREAD_HANDLER.sendRequest('getIsSearchEntityEmbedded', { entityType, id });
}

export const getSearchEntityEmbedding = async (entityType: SearchEntityType, id: string): Promise<Float32Array | null> => {
	return SEARCH_THREAD_HANDLER.sendRequest('getSearchEntityEmbedding', { entityType, id });
}

export const searchSimilarEntities = async (entityType: SearchEntityType, id: string): Promise<Array<IVectorSearchResult>> => {
	const embedding = await getSearchEntityEmbedding(entityType, id);
	if (!embedding) {
		return [];
	}

	return searchVectorRawFromEmbedding(embedding);
}

export const embedMenuItem = async (menuItem: IMenuItemBase, categoryName: string, stationName: string) => {
	const embedding = await retrieveMenuItemEmbeddings(menuItem, categoryName, stationName);
	await SEARCH_THREAD_HANDLER.sendRequest('insertSearchEmbedding', {
		entityType: SearchEntityType.menuItem,
		id:         menuItem.id,
		embedding:  new Float32Array(embedding),
	});
}

export const embedStation = async (station: ICafeStation) => {
	const embedding = await retrieveStationEmbeddings(station);
	await SEARCH_THREAD_HANDLER.sendRequest('insertSearchEmbedding', {
		entityType: SearchEntityType.station,
		id:         station.id,
		embedding:  new Float32Array(embedding),
	});
}

export const embedCafe = async (cafe: ICafe, groupId?: string) => {
	const group = CAFE_GROUP_LIST.find(group => group.id === groupId);
	if (groupId && !group) {
		throw new Error(`Group with id "${groupId}" not found`);
	}

	const embedding = await retrieveCafeEmbeddings(cafe, group);
	await SEARCH_THREAD_HANDLER.sendRequest('insertSearchEmbedding', {
		entityType: SearchEntityType.cafe,
		id:         cafe.id,
		embedding:  new Float32Array(embedding),
	});
}

export const getAllExistingEmbeddings = async (): Promise<Map<SearchEntityType, Set<string>>> => {
	return SEARCH_THREAD_HANDLER.sendRequest('getAllEmbeddedEntities', undefined);
}

export const getAllSearchQueries = async (): Promise<Set<string>> => {
	return SEARCH_THREAD_HANDLER.sendRequest('getAllSearchQueries', undefined);
}

export const getSimilarQueries = async (query: string): Promise<Array<string>> => {
	const embedding = await getQueryEmbedding(query);
	return SEARCH_THREAD_HANDLER.sendRequest('getSimilarQueries', {
		query,
		queryEmbedding: embedding
	});
}