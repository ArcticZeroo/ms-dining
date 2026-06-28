/**
 * Benchmark: how fast is the vector (sqlite-vec) KNN search, and how much does
 * over-fetching a larger top-K cost? This isolates the LOCAL vector-DB cost that
 * Option A (query-time de-dup via over-fetch) would change. It does NOT measure
 * the query-embedding (OpenAI) call, which is a fixed network cost independent of k.
 *
 * Mirrors the production schema + KNN statement in
 * server/src/worker/data/storage/vector/db.ts exactly, but against a synthetic
 * temp index so we can sweep the index size N without real data.
 *
 * Run: cd server && npx tsx src/adhoc/bench-vector-search.ts
 */

import sqlite3 from 'better-sqlite3';
import * as vec from 'sqlite-vec';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DIM = 1536;                         // matches text-embedding-3-small
const INDEX_SIZES = [2_000, 5_000, 10_000, 20_000, 30_000];
const TOP_KS = [50, 100, 200, 500];
const QUERIES_PER_CELL = 200;             // timed queries per (N, k)
const WARMUP_QUERIES = 20;

const randomUnitVector = (): Float32Array => {
    const vector = new Float32Array(DIM);
    let sumSquares = 0;
    for (let i = 0; i < DIM; i++) {
        const value = Math.random() * 2 - 1;
        vector[i] = value;
        sumSquares += value * value;
    }
    const norm = Math.sqrt(sumSquares) || 1;
    for (let i = 0; i < DIM; i++) {
        vector[i]! /= norm;
    }
    return vector;
};

interface IBuiltIndex {
    db: sqlite3.Database;
    search: sqlite3.Statement;
}

const buildIndex = (dbPath: string, n: number): IBuiltIndex => {
    const db = sqlite3(dbPath);
    db.pragma('journal_mode = WAL');
    vec.load(db);

    // Same schema as db.ts:46-52.
    db.exec(`
        CREATE VIRTUAL TABLE search_vec USING vec0(
            embedding float[${DIM}],
            +id TEXT,
            entity_type INTEGER PARTITION KEY
        )
    `);

    const insert = db.prepare('INSERT INTO search_vec (embedding, id, entity_type) VALUES (?, ?, 0)');
    const insertMany = db.transaction((count: number) => {
        for (let i = 0; i < count; i++) {
            insert.run(randomUnitVector(), `item-${i}`);
        }
    });
    insertMany(n);

    // Same KNN statement as db.ts:88-93.
    const search = db.prepare('SELECT id, distance FROM search_vec WHERE embedding MATCH ? ORDER BY distance LIMIT ?');

    return { db, search };
};

const percentile = (sortedMs: number[], p: number): number => {
    const index = Math.min(sortedMs.length - 1, Math.floor((p / 100) * sortedMs.length));
    return sortedMs[index]!;
};

const timeQueries = (search: sqlite3.Statement, k: number, count: number): number[] => {
    const times: number[] = [];
    for (let i = 0; i < count; i++) {
        const query = randomUnitVector();
        const start = performance.now();
        search.all(query, k);
        times.push(performance.now() - start);
    }
    return times;
};

// Simulate Option A's post-fetch work: resolve id -> entityKey from an in-memory
// map (what MenuItemStorageClient's cache lookup is) and keep the min distance
// per entityKey. This is the only NEW per-query cost Option A adds.
const measureDedupCost = (search: sqlite3.Statement, overfetchK: number, entityKeyById: Map<string, string>): number => {
    const query = randomUnitVector();
    const rows = search.all(query, overfetchK) as Array<{ id: string; distance: number }>;

    const start = performance.now();
    const bestByEntityKey = new Map<string, number>();
    for (const row of rows) {
        const entityKey = entityKeyById.get(row.id) ?? `name:${row.id}`;
        const existing = bestByEntityKey.get(entityKey);
        if (existing == null || row.distance < existing) {
            bestByEntityKey.set(entityKey, row.distance);
        }
    }
    return performance.now() - start;
};

console.log(`\n${'='.repeat(78)}`);
console.log(`VECTOR SEARCH BENCHMARK — dim ${DIM}, ${QUERIES_PER_CELL} queries/cell`);
console.log(`${'='.repeat(78)}`);
console.log('Each row is one index size N; columns are top-K. Values are median / p95 ms.\n');

const header = ['N \\ k'.padEnd(10), ...TOP_KS.map(k => `k=${k}`.padStart(18))].join('');
console.log(header);
console.log('-'.repeat(header.length));

for (const n of INDEX_SIZES) {
    const dir = mkdtempSync(path.join(tmpdir(), 'vecbench-'));
    const dbPath = path.join(dir, 'bench.db');
    let cells: string[] = [];
    let dedupMs = 0;

    try {
        const { db, search } = buildIndex(dbPath, n);

        // Warm up (page cache, JIT).
        timeQueries(search, TOP_KS[TOP_KS.length - 1]!, WARMUP_QUERIES);

        for (const k of TOP_KS) {
            const times = timeQueries(search, k, QUERIES_PER_CELL).sort((a, b) => a - b);
            const median = percentile(times, 50);
            const p95 = percentile(times, 95);
            cells.push(`${median.toFixed(2)} / ${p95.toFixed(2)}`.padStart(18));
        }

        // Dedup cost at the largest over-fetch, with every id mapped to an entityKey.
        const entityKeyById = new Map<string, string>();
        for (let i = 0; i < n; i++) {
            entityKeyById.set(`item-${i}`, `name:item-${i % Math.max(1, Math.floor(n / 2))}`);
        }
        const dedupSamples: number[] = [];
        for (let i = 0; i < 50; i++) {
            dedupSamples.push(measureDedupCost(search, 200, entityKeyById));
        }
        dedupSamples.sort((a, b) => a - b);
        dedupMs = percentile(dedupSamples, 50);

        db.close();
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }

    console.log(`${String(n).padEnd(10)}${cells.join('')}`);
    console.log(`${' '.repeat(10)}(Option A dedup post-processing at k=200: ${dedupMs.toFixed(3)} ms median)`);
}

console.log(`\n${'='.repeat(78)}`);
console.log('Notes:');
console.log('- This is the LOCAL vector cost only. The query-embedding (OpenAI) call is a');
console.log('  separate fixed network latency, independent of k.');
console.log('- Synthetic random vectors; real embeddings cluster more, but KNN cost is');
console.log('  dominated by the full-index scan, which is the same regardless of k.');
console.log(`${'='.repeat(78)}\n`);
