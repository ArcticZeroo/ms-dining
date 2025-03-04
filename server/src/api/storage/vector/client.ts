import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import {
    DB_ID_TO_SEARCH_ENTITY_TYPE,
    SEARCH_ENTITY_TYPE_TO_DB_ID,
    SearchEntityType
} from '@msdining/common/dist/models/search.js';
import sqlite3 from 'better-sqlite3';
import * as vec from 'sqlite-vec';
import { ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { logDebug } from '../../../util/log.js';
import { isValidEmbeddingResult, isValidVectorSearchResultArray } from '../../../util/typeguard.js';
import { retrieveEmbeddings, retrieveMenuItemEmbeddings, retrieveStationEmbeddings } from '../../openai.js';

const createVectorDatabase = (path: string) => {
    const db = sqlite3(path);
    db.pragma('journal_mode = WAL');
    vec.load(db);
    return db;
};

const SEARCH_VECTOR_DB = createVectorDatabase('search.db');

SEARCH_VECTOR_DB.exec(`
CREATE VIRTUAL TABLE IF NOT EXISTS query_vec USING vec0(
    query TEXT,
    embedding float[1536]
)
`);

SEARCH_VECTOR_DB.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_vec USING vec0(
        embedding float[1536],

        -- Auxiliary Columns - These cannot be searched but show up in the results
        +id TEXT,
        +entity_type INTEGER,
    )
`);

const INSERT_SEARCH_ENTITY_STATEMENT = SEARCH_VECTOR_DB.prepare(`
    INSERT INTO search_vec (embedding, id, entity_type)
    VALUES (?, ?, CAST(? AS INTEGER))
`);

const GET_QUERY_EMBEDDING_STATEMENT = SEARCH_VECTOR_DB.prepare(`
    SELECT embedding
    FROM query_vec
    WHERE query = ?
`);

const INSERT_QUERY_STATEMENT = SEARCH_VECTOR_DB.prepare(`
    INSERT INTO query_vec (embedding, query)
    VALUES (?, ?)
`);

const SEARCH_STATEMENT = SEARCH_VECTOR_DB.prepare(`
    SELECT id, entity_type, distance
    FROM search_vec
    WHERE embedding MATCH ?
    ORDER BY distance LIMIT ?
`);

const getAllEmbeddedItems = () => {
    const embeddedItems = new Map<SearchEntityType, Set<string /*id*/>>;

    const results = SEARCH_VECTOR_DB.prepare(`
        SELECT id, entity_type
        FROM search_vec
    `).all();

    if (isDuckTypeArray<{ id: string, entity_type: number }>(results, { id: 'string', entity_type: 'number' })) {
        for (const row of results) {
            const entityType = DB_ID_TO_SEARCH_ENTITY_TYPE[row.entity_type] as SearchEntityType;
            if (!embeddedItems.has(entityType)) {
                embeddedItems.set(entityType, new Set());
            }
            embeddedItems.get(entityType)!.add(row.id);
        }
    }

    return embeddedItems;
};

const ALL_EMBEDDED_ITEMS = getAllEmbeddedItems();

export const isEmbeddedItem = (entityType: SearchEntityType, id: string) => {
    return ALL_EMBEDDED_ITEMS.get(entityType)?.has(id) === true;
}

const markEmbeddedItem = (entityType: SearchEntityType, id: string) => {
    if (!ALL_EMBEDDED_ITEMS.has(entityType)) {
        ALL_EMBEDDED_ITEMS.set(entityType, new Set());
    }
    ALL_EMBEDDED_ITEMS.get(entityType)!.add(id);
}

export const embedMenuItem = async (menuItem: IMenuItem, categoryName: string, stationName: string) => {
    const embedding = await retrieveMenuItemEmbeddings(menuItem, categoryName, stationName);

    INSERT_SEARCH_ENTITY_STATEMENT.run(
        new Float32Array(embedding),
        menuItem.id,
        SEARCH_ENTITY_TYPE_TO_DB_ID[SearchEntityType.menuItem]
    );

    markEmbeddedItem(SearchEntityType.menuItem, menuItem.id);
};

export const embedStation = async (station: ICafeStation) => {
    const embedding = await retrieveStationEmbeddings(station);

    INSERT_SEARCH_ENTITY_STATEMENT.run(
        new Float32Array(embedding),
        station.id,
        SEARCH_ENTITY_TYPE_TO_DB_ID[SearchEntityType.station]
    );

    markEmbeddedItem(SearchEntityType.station, station.id);
};

export const embedQuery = async (query: string) => {
    const existingEmbedding = GET_QUERY_EMBEDDING_STATEMENT.get(query);
    if (existingEmbedding && isValidEmbeddingResult(existingEmbedding)) {
        logDebug(`Found existing embedding for query "${query}"`);
        return existingEmbedding.embedding;
    }

    logDebug(`No existing embedding for query "${query}", generating new one...`);
    const embedding = new Float32Array(await retrieveEmbeddings(query));
    INSERT_QUERY_STATEMENT.run(embedding, query);
    return embedding;
};

export const searchVectorRaw = async (query: string, limit: number) => {
    const embedding = await embedQuery(query);
    const results = SEARCH_STATEMENT.all(embedding, limit);

    if (!isValidVectorSearchResultArray(results)) {
        throw new Error('Invalid search results');
    }

    return results;
};