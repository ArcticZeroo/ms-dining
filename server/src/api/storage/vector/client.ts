import { SEARCH_THREAD_HANDLER } from '../../worker-thread/search.js';
import {
	retrieveCafeEmbeddings,
	retrieveEmbeddings,
	retrieveMenuItemEmbeddings,
	retrieveStationEmbeddings
} from '../../embeddings.js';
import { IEntityRef, IVectorSearchResult } from '../../../models/vector.js';
import { type INegativePenaltyResult } from './db.js';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { SearchEntityType } from '@msdining/common/models/search';
import { ICafe, ICafeStation } from '../../../models/cafe.js';
import { CAFE_GROUP_LIST } from '../../../constants/cafes.js';
import { Lock } from '@frozor/lock';

const QUERY_LOCK = new Lock();

const getQueryEmbedding = async (query: string): Promise<Float32Array> => {
    query = query.toLowerCase();

    return QUERY_LOCK.acquire(async () => {
        const existingEmbedding = await SEARCH_THREAD_HANDLER.sendRequest('getQueryEmbedding', query);

        if (existingEmbedding) {
            return existingEmbedding;
        }

        const embedding = new Float32Array(await retrieveEmbeddings(query));
        await SEARCH_THREAD_HANDLER.sendRequest('insertQueryEmbedding', { embedding, query });
        return embedding;
    });
}

export const searchVectorRawFromEmbedding = async (embedding: Float32Array): Promise<Array<IVectorSearchResult>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('getSearchResults', { query: embedding });
}

export const searchVectorRawByType = async (embedding: Float32Array, entityType: SearchEntityType, limit: number): Promise<Array<IVectorSearchResult>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('getSearchResultsByType', { query: embedding, entityType, limit });
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

export const searchSimilarEntitiesByType = async (entityType: SearchEntityType, id: string, limit: number): Promise<Array<IVectorSearchResult>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('searchSimilarByEntityId', {
        entityType,
        id,
        limit,
    });
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

export const DAILY_STATION_ID_SEPARATOR = '::';

export const makeDailyStationId = (stationId: string, dateString: string) =>
    `${stationId}${DAILY_STATION_ID_SEPARATOR}${dateString}`;

export const parseDailyStationId = (compositeId: string) => {
    const separatorIndex = compositeId.indexOf(DAILY_STATION_ID_SEPARATOR);
    if (separatorIndex === -1) {
        throw new Error(`Invalid daily station ID: ${compositeId}`);
    }
    return {
        stationId:  compositeId.slice(0, separatorIndex),
        dateString: compositeId.slice(separatorIndex + DAILY_STATION_ID_SEPARATOR.length),
    };
};

export const embedDailyStation = async (station: ICafeStation, dateString: string) => {
    const embedding = await retrieveStationEmbeddings(station);
    await SEARCH_THREAD_HANDLER.sendRequest('insertSearchEmbedding', {
        entityType: SearchEntityType.dailyStation,
        id:         makeDailyStationId(station.id, dateString),
        embedding:  new Float32Array(embedding),
    });
}

export const deleteSearchEmbedding = async (entityType: SearchEntityType, id: string) => {
    await SEARCH_THREAD_HANDLER.sendRequest('deleteSearchEmbedding', { entityType, id });
}

export const getAllEmbeddedIdsByType = async (entityType: SearchEntityType): Promise<Set<string>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('getAllEmbeddedIdsByType', entityType);
}

export const deleteAllByEntityType = async (entityType: SearchEntityType) => {
    await SEARCH_THREAD_HANDLER.sendRequest('deleteAllByEntityType', entityType);
}

export const pruneExpiredDailyStationEmbeddings = async (validDateStrings: Set<string>) => {
    const allDailyStationIds = await getAllEmbeddedIdsByType(SearchEntityType.dailyStation);
    for (const compositeId of allDailyStationIds) {
        const { dateString } = parseDailyStationId(compositeId);
        if (!validDateStrings.has(dateString)) {
            await deleteSearchEmbedding(SearchEntityType.dailyStation, compositeId);
        }
    }
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

export const computeCentroidSearch = async (entities: Array<IEntityRef>, searchEntityType: SearchEntityType, limit: number): Promise<Array<IVectorSearchResult>> => {
    return SEARCH_THREAD_HANDLER.sendRequest('computeCentroidSearch', { entities, searchEntityType, limit });
}

export const computeNegativePenalties = async (candidateIds: string[], negativeEntities: Array<IEntityRef>, candidateEntityType: SearchEntityType): Promise<INegativePenaltyResult[]> => {
    return SEARCH_THREAD_HANDLER.sendRequest('computeNegativePenalties', { candidateIds, negativeEntities, candidateEntityType });
}

export { type INegativePenaltyResult } from './db.js';

export const sortByEmbeddingDiversity = async (candidateIds: string[], entityType: SearchEntityType, scores: number[], lambda: number, seed: string): Promise<string[]> => {
    return SEARCH_THREAD_HANDLER.sendRequest('sortByEmbeddingDiversity', { candidateIds, entityType, scores, lambda, seed });
}

export const diverseWeightedSample = async (entityIds: string[], entityType: SearchEntityType, weights: number[], count: number, seed: string): Promise<string[]> => {
    return SEARCH_THREAD_HANDLER.sendRequest('diverseWeightedSample', { entityIds, entityType, weights, count, seed });
}