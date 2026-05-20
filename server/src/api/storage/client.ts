import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';
import { PrismaTransactionClient, ReadOnlyPrismaClient } from '../../models/prisma.js';
import { ENVIRONMENT_SETTINGS } from '../../util/env.js';
import { lazy, lazyAsync } from '../../util/lazy.js';
import { getDbPriority } from './db-context.js';
import { DB_METRIC_NAMES, DB_METRICS } from './db-metrics.js';
import { PrioritySemaphore } from './priority-semaphore.js';
import { requireEnvironmentVariable } from '../../constants/env.js';

// With just one semaphore, we were seeing db writes timeout under load (i.e. initial boot while loading cafes)
// because we would queue multiple writes in parallel and hit SQLite's busy timeout, even though we were actually
// willing to wait however long it takes.
// But with WAL mode, readers and a single writer proceed concurrently — they never
// block each other. The only contention is writer-vs-writer. We exploit this
// with two semaphores:
//
//   readSemaphore  (max = dbMaxConcurrency): caps parallel reads so we don't
//                  overwhelm the event loop or generate excessive disk I/O.
//
//   writeSemaphore (max = 1): serialises all writes (single-statement and
//                  multi-statement transactions) against each other at the app
//                  level, so SQLite's busy_timeout is never hit and Prisma never
//                  surfaces P1008 "socket timeout" errors.
//
// This gives us full read parallelism while eliminating write-lock contention.
const readSemaphore = new PrioritySemaphore(ENVIRONMENT_SETTINGS.dbMaxConcurrency);
const writeSemaphore = new PrioritySemaphore(1);

const SQLITE_BUSY_TIMEOUT_MS = 30_000;
const PRISMA_TRANSACTION_MAX_WAIT_MS = 15_000;
const PRISMA_TRANSACTION_TIMEOUT_MS = 30_000;

// SQLite tuning for concurrent access:
//   - journal_mode=WAL: readers don't block writers and vice versa. Persists
//     in the database file once set.
//   - synchronous=NORMAL: safe with WAL (no corruption on crash, only risk is
//     losing the very last commit on power loss). Per-connection.
//   - busy_timeout: fallback in case something bypasses our app-level write
//     serialisation. 30s gives substantial headroom.
//
// All three are idempotent. We run them on every startup so a fresh PrismaClient
// is always tuned correctly. Queued behind a `READY` promise so the first
// caller waits for tuning to finish before issuing real work.

// We pass the URL through the libsql adapter explicitly (rather than letting
// Prisma's bundled dotenv pick up process.env on import) so the snapshot
// taken at module-load time doesn't leak into integration tests that set
// DATABASE_URL after import.
//
// `timestampFormat: 'unixepoch-ms'` preserves backward compatibility with
// the existing production database, whose DateTime columns were stored as
// unix epoch milliseconds by Prisma's native sqlite driver. The libsql
// adapter defaults to ISO 8601 strings; we override here to avoid reading
// old data as garbage.
const PRISMA_CLIENT = lazy(() => {
	// The libsql adapter requires an explicit URL (unlike the prior native sqlite driver, which Prisma read from .env on its own). Set DATABASE_URL in your environment or .env.
    const databaseUrl = requireEnvironmentVariable('DATABASE_URL');

    const adapter = new PrismaLibSql(
        { url: databaseUrl },
        { timestampFormat: 'unixepoch-ms' },
    );
    return new PrismaClient({ adapter });
});

const READY = lazyAsync(async () => {
    const client = PRISMA_CLIENT.value;
    await client.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    await client.$queryRawUnsafe('PRAGMA synchronous=NORMAL;');
    await client.$queryRawUnsafe(`PRAGMA busy_timeout=${SQLITE_BUSY_TIMEOUT_MS};`);
});

export const disconnectPrismaClient = async (): Promise<void> => {
    if (!PRISMA_CLIENT.isInitialized) {
        return;
    }
    const client = PRISMA_CLIENT.value;
    PRISMA_CLIENT.reset();
    READY.reset();
    await client.$disconnect();
};

const recordSemaphoreMetrics = (
    semaphore: PrioritySemaphore,
    semaphoreName: string,
    priority: string,
    queuedAt: number,
) => {
    const startedAt = performance.now();
    const waitMs = startedAt - queuedAt;
    const tags = { priority, semaphore: semaphoreName };

    DB_METRICS.record(DB_METRIC_NAMES.waitMs, waitMs, tags);
    DB_METRICS.record(DB_METRIC_NAMES.queueDepth, semaphore.queueDepth, tags);
    DB_METRICS.record(DB_METRIC_NAMES.inFlight, semaphore.inFlight, tags);

    return { startedAt, tags };
};

/**
 * For read-only operations. Runs concurrently up to `dbMaxConcurrency`.
 */
export const usePrismaClient = async <T>(callback: (client: ReadOnlyPrismaClient) => Promise<T>) => {
    const priority = getDbPriority();
    const queuedAt = performance.now();

    return readSemaphore.acquire(priority, async () => {
        await READY.value;

        const { startedAt, tags } = recordSemaphoreMetrics(readSemaphore, 'read', priority, queuedAt);

        try {
            return await callback(PRISMA_CLIENT.value);
        } finally {
            const durationMs = performance.now() - startedAt;
            DB_METRICS.record(DB_METRIC_NAMES.durationMs, durationMs, tags);
        }
    });
};

/**
 * For single-statement writes (create, update, upsert, delete).
 * Serialised against other writes and transactions via the write semaphore.
 */
export const usePrismaWrite = async <T>(callback: (client: PrismaClient) => Promise<T>) => {
    const priority = getDbPriority();
    const queuedAt = performance.now();

    return writeSemaphore.acquire(priority, async () => {
        await READY.value;

        const { startedAt, tags } = recordSemaphoreMetrics(writeSemaphore, 'write', priority, queuedAt);

        try {
            return await callback(PRISMA_CLIENT.value);
        } finally {
            const durationMs = performance.now() - startedAt;
            DB_METRICS.record(DB_METRIC_NAMES.durationMs, durationMs, tags);
        }
    });
};

/**
 * For multi-statement write transactions. Serialised against other writes
 * and transactions via the write semaphore.
 */
export const usePrismaTransaction = async <T>(callback: (tx: PrismaTransactionClient) => Promise<T>) => {
    const priority = getDbPriority();
    const queuedAt = performance.now();

    return writeSemaphore.acquire(priority, async () => {
        await READY.value;

        const { startedAt, tags } = recordSemaphoreMetrics(writeSemaphore, 'transaction', priority, queuedAt);

        try {
            return await PRISMA_CLIENT.value.$transaction(async (tx) => {
                return callback(tx);
            }, {
                maxWait: PRISMA_TRANSACTION_MAX_WAIT_MS,
                timeout: PRISMA_TRANSACTION_TIMEOUT_MS,
            });
        } finally {
            const durationMs = performance.now() - startedAt;
            DB_METRICS.record(DB_METRIC_NAMES.durationMs, durationMs, tags);
        }
    });
}
