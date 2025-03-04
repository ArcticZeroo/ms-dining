import { DB_ID_TO_SEARCH_ENTITY_TYPE, SearchEntityType } from '@msdining/common/dist/models/search.js';
import { searchVectorRaw } from './client.js';

export const queryVectorSearch = async (query: string, limit: number) => {
    const rawResults = await searchVectorRaw(query, limit);

    for (const result of rawResults) {
        const entityType = DB_ID_TO_SEARCH_ENTITY_TYPE[result.entity_type] as SearchEntityType;
        if (!entityType) {
            throw new Error(`Invalid entity type: ${result.entity_type}`);
        }

        if (entityType === SearchEntityType.menuItem) {

        } else if (entityType === SearchEntityType.station) {

        }
    }
}