import sqlite3 from 'better-sqlite3';
import * as vec from 'sqlite-vec';
import {
	DB_ID_TO_SEARCH_ENTITY_TYPE,
	SEARCH_ENTITY_TYPE_TO_DB_ID,
	SearchEntityType
} from '@msdining/common/models/search';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import { isValidEmbeddingResult, isValidVectorSearchResultArray } from '../../../util/typeguard.js';
import { IEntityRef } from '../../../models/vector.js';

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
    query TEXT UNIQUE,
    embedding float[1536]
)
`);

            // Schema versioning: bump when search_vec schema changes.
            // Partition key on entity_type allows filtered vector searches (e.g. menu items only).
            const SEARCH_VEC_SCHEMA_VERSION = 2;
            db.exec(`CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value INTEGER)`);
            const row = db.prepare('SELECT value FROM schema_meta WHERE key = ?').get('search_vec_version') as { value: number } | undefined;
            if (!row || row.value !== SEARCH_VEC_SCHEMA_VERSION) {
                db.exec('DROP TABLE IF EXISTS search_vec');
                db.prepare('INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)').run('search_vec_version', SEARCH_VEC_SCHEMA_VERSION);
            }

            db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_vec USING vec0(
        embedding float[1536],
        +id TEXT,
        entity_type INTEGER PARTITION KEY
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

const SEARCH_BY_TYPE_STATEMENT = createPreparedStatementFactory(`
    SELECT id, entity_type, distance
    FROM search_vec
    WHERE embedding MATCH ?
    AND entity_type = CAST(? AS INTEGER)
    ORDER BY distance LIMIT ?
`);

const ALL_EMBEDDED_ITEMS_STATEMENT = createPreparedStatementFactory(`
	SELECT id, entity_type
	FROM search_vec
`);

const GET_SEARCH_ENTITY_STATEMENT = createPreparedStatementFactory(`
	SELECT embedding
	FROM search_vec
	WHERE id = ? AND entity_type = CAST(? AS INTEGER)
`);

const DELETE_SEARCH_ENTITY_STATEMENT = createPreparedStatementFactory(`
	DELETE FROM search_vec
	WHERE id = ? AND entity_type = CAST(? AS INTEGER)
`);

const ALL_EMBEDDED_IDS_BY_TYPE_STATEMENT = createPreparedStatementFactory(`
	SELECT id
	FROM search_vec
	WHERE entity_type = CAST(? AS INTEGER)
`);

const DELETE_ALL_BY_TYPE_STATEMENT = createPreparedStatementFactory(`
	DELETE FROM search_vec
	WHERE entity_type = CAST(? AS INTEGER)
`);

const SEARCH_QUERIES_STATEMENT = createPreparedStatementFactory(`
	SELECT DISTINCT(query)
	FROM query_vec
	WHERE embedding MATCH ? AND LOWER(QUERY) != ? AND k = ?
	ORDER BY distance
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

export const getAllEmbeddedEntities = () => ALL_EMBEDDED_ITEMS;

export const isEmbeddedEntity = (entityType: SearchEntityType, id: string) => {
    return ALL_EMBEDDED_ITEMS.get(entityType)?.has(id) === true;
}

const markEmbeddedItem = (entityType: SearchEntityType, id: string) => {
    if (!ALL_EMBEDDED_ITEMS.has(entityType)) {
        ALL_EMBEDDED_ITEMS.set(entityType, new Set());
    }
	ALL_EMBEDDED_ITEMS.get(entityType)!.add(id);
}

const unmarkEmbeddedItem = (entityType: SearchEntityType, id: string) => {
    ALL_EMBEDDED_ITEMS.get(entityType)?.delete(id);
}

export const insertSearchEntityEmbedding = (embedding: Float32Array, id: string, entityType: SearchEntityType) => {
    INSERT_SEARCH_ENTITY_STATEMENT().run(embedding, id, SEARCH_ENTITY_TYPE_TO_DB_ID[entityType]);
    markEmbeddedItem(entityType, id);
}

export const deleteSearchEntityEmbedding = (entityType: SearchEntityType, id: string) => {
    DELETE_SEARCH_ENTITY_STATEMENT().run(id, SEARCH_ENTITY_TYPE_TO_DB_ID[entityType]);
    unmarkEmbeddedItem(entityType, id);
}

export const getAllEmbeddedIdsByType = (entityType: SearchEntityType): Set<string> => {
    return ALL_EMBEDDED_ITEMS.get(entityType) ?? new Set();
}

export const deleteAllByEntityType = (entityType: SearchEntityType) => {
    DELETE_ALL_BY_TYPE_STATEMENT().run(SEARCH_ENTITY_TYPE_TO_DB_ID[entityType]);
    ALL_EMBEDDED_ITEMS.delete(entityType);
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

export const searchVectorRawByType = async (queryEmbedding: Float32Array, entityType: SearchEntityType, limit: number) => {
    const results = SEARCH_BY_TYPE_STATEMENT().all(queryEmbedding, SEARCH_ENTITY_TYPE_TO_DB_ID[entityType], limit);

    if (!isValidVectorSearchResultArray(results)) {
        throw new Error('Invalid search results');
    }

    return results;
};

export const getAllSearchQueries = () => {
    const statement = getSearchVectorDatabase().prepare('SELECT query FROM query_vec');
    const results = statement.all();

    if (!isDuckTypeArray<{ query: string }>(results, { query: 'string' })) {
        throw new Error('Invalid query results');
    }

    return new Set(results.map(row => row.query));
}

export const getSearchEntityEmbedding = (entityType: SearchEntityType, id: string): Float32Array | null => {
    const result = GET_SEARCH_ENTITY_STATEMENT().get(id, SEARCH_ENTITY_TYPE_TO_DB_ID[entityType]);

    if (isValidEmbeddingResult(result)) {
        const raw = result.embedding;
        // sqlite-vec returns raw bytes as Uint8Array despite the type; wrap as Float32Array
        if (raw.BYTES_PER_ELEMENT !== 4) {
            const bytes = raw as unknown as Uint8Array;
            return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
        }
        return raw;
    }

    return null;
}

export const searchSimilarByEntityId = (entityType: SearchEntityType, id: string, limit: number) => {
    const embedding = getSearchEntityEmbedding(entityType, id);
    if (!embedding) {
        return [];
    }
    return searchVectorRawByType(embedding, entityType, limit);
};

export const computeCentroidAndSearch = (entities: Array<IEntityRef>, searchEntityType: SearchEntityType, limit: number) => {
    const embeddings: Float32Array[] = [];
    for (const { entityType, id } of entities) {
        const embedding = getSearchEntityEmbedding(entityType, id);
        if (embedding) {
            embeddings.push(embedding);
        }
    }

    if (embeddings.length === 0) {
        return [];
    }

    const dim = embeddings[0]!.length;
    const centroid = new Float32Array(dim);
    for (const embedding of embeddings) {
        for (let i = 0; i < dim; i++) {
            centroid[i]! += embedding[i]!;
        }
    }
    for (let i = 0; i < dim; i++) {
        centroid[i]! /= embeddings.length;
    }

    return searchVectorRawByType(centroid, searchEntityType, limit);
};

export interface INegativePenaltyResult {
    id: string;
    penaltyMultiplier: number;
}

export const computeNegativePenalties = (candidateIds: string[], negativeEntities: Array<IEntityRef>, candidateEntityType: SearchEntityType): INegativePenaltyResult[] => {
    const negativeEmbeddings: Float32Array[] = [];
    for (const { entityType, id } of negativeEntities) {
        const embedding = getSearchEntityEmbedding(entityType, id);
        if (embedding) {
            negativeEmbeddings.push(embedding);
        }
    }

    if (negativeEmbeddings.length === 0) {
        return candidateIds.map(id => ({ id, penaltyMultiplier: 1 }));
    }

    return candidateIds.map(id => {
        const embedding = getSearchEntityEmbedding(candidateEntityType, id);
        if (!embedding) {
            return { id, penaltyMultiplier: 1 };
        }

        let penaltyMultiplier = 1;
        for (const negativeEmbedding of negativeEmbeddings) {
            let distance = 0;
            for (let i = 0; i < embedding.length; i++) {
                const d = (embedding[i] ?? 0) - (negativeEmbedding[i] ?? 0);
                distance += d * d;
            }
            distance = Math.sqrt(distance);
            if (distance < 0.5) {
                penaltyMultiplier *= 0.5;
            }
        }

        return { id, penaltyMultiplier };
    });
};

const VEC_DISTANCE_COSINE_STATEMENT = createPreparedStatementFactory(
    'SELECT vec_distance_cosine(?, ?) as distance'
);

// Uses sqlite-vec's optimized C implementation for cosine distance
const cosineDistance = (a: Float32Array, b: Float32Array): number => {
    const result = VEC_DISTANCE_COSINE_STATEMENT().get(a, b) as { distance: number } | undefined;
    return result?.distance ?? 1;
};

/**
 * Greedy MMR (Maximal Marginal Relevance) ordering with random tiebreaking.
 * Balances relevance (score) with diversity (cosine distance from already-selected items).
 * Items without embeddings are placed at the end in original score order.
 */
export const sortByEmbeddingDiversity = (
    candidateIds: string[],
    entityType: SearchEntityType,
    scores: number[],
    lambda: number,
    random: () => number,
): string[] => {
    if (candidateIds.length === 0) {
        return [];
    }

    // Normalize scores to 0-1 range for MMR
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const scoreRange = maxScore - minScore || 1;

    const candidates: Array<{ id: string; embedding: Float32Array | null; normalizedScore: number }> = [];
    for (let i = 0; i < candidateIds.length; i++) {
        candidates.push({
            id:              candidateIds[i]!,
            embedding:       getSearchEntityEmbedding(entityType, candidateIds[i]!),
            normalizedScore: (scores[i]! - minScore) / scoreRange,
        });
    }

    const withEmbeddings = candidates.filter(c => c.embedding != null);
    const withoutEmbeddings = candidates.filter(c => c.embedding == null);

    const result: string[] = [];
    const selectedEmbeddings: Float32Array[] = [];
    const remaining = new Set(withEmbeddings.map((_, i) => i));

    const TIEBREAK_NOISE = 0.01;

    while (remaining.size > 0) {
        let bestIndex = -1;
        let bestMmr = -Infinity;

        for (const idx of remaining) {
            const candidate = withEmbeddings[idx]!;
            const relevance = candidate.normalizedScore;

            let maxSim = 0;
            for (const selectedEmb of selectedEmbeddings) {
                // cosine distance = 1 - cosine similarity
                const sim = 1 - cosineDistance(candidate.embedding!, selectedEmb);
                if (sim > maxSim) maxSim = sim;
            }

            const mmr = lambda * relevance - (1 - lambda) * maxSim + TIEBREAK_NOISE * random();

            if (mmr > bestMmr) {
                bestMmr = mmr;
                bestIndex = idx;
            }
        }

        remaining.delete(bestIndex);
        const selected = withEmbeddings[bestIndex]!;
        result.push(selected.id);
        selectedEmbeddings.push(selected.embedding!);
    }

    // Append items without embeddings at the end, sorted by original score
    withoutEmbeddings
        .sort((a, b) => b.normalizedScore - a.normalizedScore)
        .forEach(c => result.push(c.id));

    return result;
};

/**
 * Weighted random sampling with embedding diversity.
 * Like weightedRandomSample but penalizes items close to already-selected items in embedding space.
 */
export const diverseWeightedSample = (
    entityIds: string[],
    entityType: SearchEntityType,
    weights: number[],
    count: number,
    random: () => number,
): string[] => {
    if (entityIds.length <= count) {
        return entityIds;
    }

    const candidates: Array<{ id: string; embedding: Float32Array | null; weight: number }> = [];
    for (let i = 0; i < entityIds.length; i++) {
        candidates.push({
            id:        entityIds[i]!,
            embedding: getSearchEntityEmbedding(entityType, entityIds[i]!),
            weight:    Math.max(weights[i]!, 0.001),
        });
    }

    const selected: string[] = [];
    const selectedEmbeddings: Float32Array[] = [];
    const remainingIndices = new Set(candidates.map((_, i) => i));

    for (let pick = 0; pick < count && remainingIndices.size > 0; pick++) {
        // Compute effective weights: weight * (1 + min_distance_to_selected)
        let totalEffectiveWeight = 0;
        const effectiveWeights: Array<{ index: number; weight: number }> = [];

        for (const remainingIndex of remainingIndices) {
            const candidate = candidates[remainingIndex]!;
            let diversityBonus = 1;

            if (candidate.embedding && selectedEmbeddings.length > 0) {
                let minSim = 1;
                for (const selEmb of selectedEmbeddings) {
                    const sim = 1 - cosineDistance(candidate.embedding, selEmb);
                    if (sim < minSim) minSim = sim;
                }
                // Higher distance (lower similarity) = larger bonus
                diversityBonus = 1 + (1 - minSim);
            }

            const effectiveWeight = candidate.weight * diversityBonus;
            effectiveWeights.push({ index: remainingIndex, weight: effectiveWeight });
            totalEffectiveWeight += effectiveWeight;
        }

        // Weighted random selection from effective weights
        let target = random() * totalEffectiveWeight;
        let selectedIndex = effectiveWeights[0]!.index;
        for (const { index, weight } of effectiveWeights) {
            target -= weight;
            if (target <= 0) {
                selectedIndex = index;
                break;
            }
        }

        remainingIndices.delete(selectedIndex);
        const picked = candidates[selectedIndex]!;
        selected.push(picked.id);
        if (picked.embedding) {
            selectedEmbeddings.push(picked.embedding);
        }
    }

    return selected;
};

export const searchForSimilarQueries = async (queryEmbedding: Float32Array, query: string, limit: number) => {
    // random dupes seem to appear, and I can't figure out why, so we just double the limit and slice later
    const results = SEARCH_QUERIES_STATEMENT().all(queryEmbedding, query.toLowerCase(), limit * 2);

    if (!isDuckTypeArray<{ query: string }>(results, { query: 'string' })) {
        throw new Error('Invalid search results');
    }

    return results.slice(0, limit).map(row => row.query);
}

export const clearDuplicatedQueries = () => {
    const db = getSearchVectorDatabase();

    // For each group of LOWER(query), delete all but one and make sure that one ends up lowercase
    db.exec(`
		DELETE FROM query_vec
		WHERE rowid NOT IN (
			SELECT MIN(rowid)
			FROM query_vec
			GROUP BY LOWER(query)
		)
	`);

    db.exec(`
		UPDATE query_vec
		SET query = LOWER(query)
	`);

    populateAllEmbeddedItems();
}