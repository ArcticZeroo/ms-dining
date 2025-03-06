import sqlite3 from 'better-sqlite3';
import * as vec from 'sqlite-vec';
import {
	DB_ID_TO_SEARCH_ENTITY_TYPE,
	SEARCH_ENTITY_TYPE_TO_DB_ID,
	SearchEntityType
} from '@msdining/common/dist/models/search.js';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import { isValidEmbeddingResult, isValidVectorSearchResultArray } from '../../../util/typeguard.js';

const createVectorDatabase = (path: string) => {
	const db = sqlite3(path);
	db.pragma('journal_mode = WAL');
	vec.load(db);
	return db;
};

const createDatabaseFactory = (path: string) => {
	let db: sqlite3.Database | null = null;

	return () => {
		if (!db) {
			db = createVectorDatabase(path);

			db.exec(`
CREATE VIRTUAL TABLE IF NOT EXISTS query_vec USING vec0(
    query TEXT,
    embedding float[1536]
)
`);

			db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_vec USING vec0(
        embedding float[1536],

        -- Auxiliary Columns - These cannot be searched but show up in the results
        +id TEXT,
        +entity_type INTEGER,
    )
`);
		}

		return db;
	}
}

const getSearchVectorDatabase = createDatabaseFactory('search.db');

const createPreparedStatementFactory = (sql: string) => {
	let statement: sqlite3.Statement | null = null;
	return () => {
		if (!statement) {
			statement = getSearchVectorDatabase().prepare(sql);
		}

		return statement;
	}
}

const INSERT_SEARCH_ENTITY_STATEMENT = createPreparedStatementFactory(`
    INSERT INTO search_vec (embedding, id, entity_type)
    VALUES (?, ?, CAST(? AS INTEGER))
`);

const GET_QUERY_EMBEDDING_STATEMENT = createPreparedStatementFactory(`
    SELECT embedding
    FROM query_vec
    WHERE query = ?
`);

const INSERT_QUERY_STATEMENT = createPreparedStatementFactory(`
    INSERT INTO query_vec (embedding, query)
    VALUES (?, ?)
`);

const SEARCH_STATEMENT = createPreparedStatementFactory(`
    SELECT id, entity_type, distance
    FROM search_vec
    WHERE embedding MATCH ?
    ORDER BY distance LIMIT ?
`);

const ALL_EMBEDDED_ITEMS_STATEMENT = createPreparedStatementFactory(`
	SELECT id, entity_type
	FROM search_vec
`);

const populateAllEmbeddedItems = () => {
	const embeddedItems = new Map<SearchEntityType, Set<string /*id*/>>;

	const results = ALL_EMBEDDED_ITEMS_STATEMENT().all();

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

const ALL_EMBEDDED_ITEMS = populateAllEmbeddedItems();

export const getAllEmbeddedItems = () => ALL_EMBEDDED_ITEMS;

export const isEmbeddedEntity = (entityType: SearchEntityType, id: string) => {
	return ALL_EMBEDDED_ITEMS.get(entityType)?.has(id) === true;
}

const markEmbeddedItem = (entityType: SearchEntityType, id: string) => {
	if (!ALL_EMBEDDED_ITEMS.has(entityType)) {
		ALL_EMBEDDED_ITEMS.set(entityType, new Set());
	}
	ALL_EMBEDDED_ITEMS.get(entityType)!.add(id);
}

export const insertSearchEntityEmbedding = (embedding: Float32Array, id: string, entityType: SearchEntityType) => {
	INSERT_SEARCH_ENTITY_STATEMENT().run(embedding, id, SEARCH_ENTITY_TYPE_TO_DB_ID[entityType]);
	markEmbeddedItem(entityType, id);
}

export const insertQueryEmbedding = (embedding: Float32Array, query: string) => {
	INSERT_QUERY_STATEMENT().run(embedding, query);
}

export const getQueryEmbedding = (query: string) => {
	const result = GET_QUERY_EMBEDDING_STATEMENT().get(query);

	if (isValidEmbeddingResult(result)) {
		return result.embedding;
	}

	return null;
}

export const searchVectorRaw = async (queryEmbedding: Float32Array, limit: number) => {
	const results = SEARCH_STATEMENT().all(queryEmbedding, limit);

	if (!isValidVectorSearchResultArray(results)) {
		throw new Error('Invalid search results');
	}

	return results;
};
