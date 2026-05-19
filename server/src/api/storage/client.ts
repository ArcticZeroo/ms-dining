import { PrismaClient } from '@prisma/client';
import { PrismaTransactionClient, ReadOnlyPrismaClient } from '../../models/prisma.js';
import { ENVIRONMENT_SETTINGS } from '../../util/env.js';
import { lazy, lazyAsync } from '../../util/lazy.js';
import { logBoot } from '../../util/boot-diagnostics.js';
import { getDbPriority } from './db-context.js';
import { DB_METRIC_NAMES, DB_METRICS } from './db-metrics.js';
import { PrioritySemaphore } from './priority-semaphore.js';

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

// The URL is passed to PrismaClient explicitly (rather than letting it read
// process.env on construction) so the snapshot taken by @prisma/client's
// bundled dotenv on import doesn't leak into integration tests.
const PRISMA_CLIENT = lazy(() => {
    const start = performance.now();
    logBoot('PRISMA_CLIENT factory invoked');
    const databaseUrl = process.env.DATABASE_URL;
    const client = databaseUrl
        ? new PrismaClient({ datasourceUrl: databaseUrl })
        : new PrismaClient();
    logBoot(`PRISMA_CLIENT constructed (${Math.round(performance.now() - start)}ms)`);
    return client;
});

const READY = lazyAsync(async () => {
    const start = performance.now();
    logBoot('READY factory invoked');
    const client = PRISMA_CLIENT.value;
    await client.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    logBoot(`READY PRAGMA journal_mode done (${Math.round(performance.now() - start)}ms)`);
    await client.$queryRawUnsafe('PRAGMA synchronous=NORMAL;');
    logBoot(`READY PRAGMA synchronous done (${Math.round(performance.now() - start)}ms)`);
    await client.$queryRawUnsafe(`PRAGMA busy_timeout=${SQLITE_BUSY_TIMEOUT_MS};`);
    logBoot(`READY resolved (${Math.round(performance.now() - start)}ms)`);
});

let firstReadAcquireLogged = false;
let firstWriteAcquireLogged = false;

const logFirstAcquire = (which: 'read' | 'write', semaphore: PrioritySemaphore, priority: string) => {
    if (which === 'read') {
        if (firstReadAcquireLogged) {
            return;
        }
        firstReadAcquireLogged = true;
    } else {
        if (firstWriteAcquireLogged) {
            return;
        }
        firstWriteAcquireLogged = true;
    }
    logBoot(`first ${which}Semaphore acquire (priority=${priority}, queueDepth=${semaphore.queueDepth}, inFlight=${semaphore.inFlight})`);
};

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

    logFirstAcquire('read', readSemaphore, priority);

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

    logFirstAcquire('write', writeSemaphore, priority);

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

    logFirstAcquire('write', writeSemaphore, priority);

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
