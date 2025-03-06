import { SEARCH_THREAD_HANDLER } from '../../worker-thread/search.js';
import { retrieveEmbeddings, retrieveMenuItemEmbeddings, retrieveStationEmbeddings } from '../../openai.js';
import { IVectorSearchResult } from '../../../models/vector.js';
import { IMenuItem } from '@msdining/common/dist/models/cafe.js';
import { SearchEntityType } from '@msdining/common/dist/models/search.js';
import { ICafeStation } from '../../../models/cafe.js';

const getQueryEmbedding = async (query: string): Promise<Float32Array> => {
	const existingEmbedding = await SEARCH_THREAD_HANDLER.sendRequest('getQueryEmbedding', query);

	if (existingEmbedding) {
		return existingEmbedding;
	}

	const embedding = new Float32Array(await retrieveEmbeddings(query));
	await SEARCH_THREAD_HANDLER.sendRequest('insertQueryEmbedding', { embedding, query });
	return embedding;
}

export const searchVectorRaw = async (query: string): Promise<Array<IVectorSearchResult>> => {
	const embedding = await getQueryEmbedding(query);
	return SEARCH_THREAD_HANDLER.sendRequest('getSearchResults', embedding);
}

export const isEmbeddedEntity = async (entityType: SearchEntityType, id: string): Promise<boolean> => {
	return SEARCH_THREAD_HANDLER.sendRequest('getIsSearchEntityEmbedded', { entityType, id });
}

export const embedMenuItem = async (menuItem: IMenuItem, categoryName: string, stationName: string) => {
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

export const getAllExistingEmbeddings = async (): Promise<Map<SearchEntityType, Set<string>>> => {
	return SEARCH_THREAD_HANDLER.sendRequest('getAllEmbeddedEntities', undefined);
}