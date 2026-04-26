import { PrismaClient } from '@prisma/client';
import { PrismaTransactionClient } from '../../models/prisma.js';
import { ENVIRONMENT_SETTINGS } from '../../util/env.js';
import { logInfo } from '../../util/log.js';
import { getDbPriority } from './db-context.js';
import { DB_METRIC_NAMES, DB_METRICS } from './db-metrics.js';
import { PrioritySemaphore } from './priority-semaphore.js';

// At some point, docs saied that perf can be bad if we make parallel requests to SQLite
// It seems that something changed and this is no longer the case. Running benchmarks
// in adhoc/bench-prisma-concurrency shows that we get large speedups by adding concurrency,
// though those benefits generally fall off after n=2 (and strongly after n=4).
const databaseSemaphore = new PrioritySemaphore(ENVIRONMENT_SETTINGS.dbMaxConcurrency);

const prismaClient = new PrismaClient();

const SQLITE_BUSY_TIMEOUT_MS = 30_000;
const PRISMA_TRANSACTION_MAX_WAIT_MS = 15_000;
const PRISMA_TRANSACTION_TIMEOUT_MS = 30_000;

// SQLite tuning for concurrent access:
//   - journal_mode=WAL: readers don't block writers and vice versa. Persists
//     in the database file once set.
//   - synchronous=NORMAL: safe with WAL (no corruption on crash, only risk is
//     losing the very last commit on power loss). Per-connection.
//   - busy_timeout: when the writer lock is held, other callers wait up to
//     this long for it instead of immediately erroring with SQLITE_BUSY,
//     which is what surfaces as Prisma's P1008 "socket timeout". 30s gives
//     us substantial headroom for slower disks (e.g. the prod VPS).
//
// All three are idempotent. We run them on every startup so a fresh PrismaClient
// is always tuned correctly. Queued behind a `ready` promise so the first
// caller through `usePrismaClient` waits for tuning to finish before issuing
// real work — otherwise a transaction could start on the default settings.
const ready = (async () => {
    // PRAGMA statements return result rows (e.g. journal_mode returns the new
    // mode), so they must go through $queryRawUnsafe — $executeRawUnsafe
    // rejects any query that produces a result set.
    await prismaClient.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
    await prismaClient.$queryRawUnsafe('PRAGMA synchronous=NORMAL;');
    await prismaClient.$queryRawUnsafe(`PRAGMA busy_timeout=${SQLITE_BUSY_TIMEOUT_MS};`);
    logInfo(`SQLite configured: journal_mode=WAL, synchronous=NORMAL, busy_timeout=${SQLITE_BUSY_TIMEOUT_MS}`);
})();

export const disconnectPrismaClient = async (): Promise<void> => {
    // Triggers a SQLite WAL checkpoint (merges WAL contents back into the
    // main .db file) and closes the connection cleanly. Safe to call after
    // shutdown handlers; any in-flight `usePrismaClient` callers complete
    // first because the semaphore is drained before disconnect runs.
    await prismaClient.$disconnect();
};

export const usePrismaClient = async <T>(callback: (client: PrismaClient) => Promise<T>) => {
    const priority = getDbPriority();
    const queuedAt = performance.now();

    return databaseSemaphore.acquire(priority, async () => {
        await ready;

        const startedAt = performance.now();
        const waitMs = startedAt - queuedAt;

        DB_METRICS.record(DB_METRIC_NAMES.waitMs, waitMs, { priority });
        // Sample queue/in-flight at acquire time — gives a useful gauge of
        // contention without another timer.
        DB_METRICS.record(DB_METRIC_NAMES.queueDepth, databaseSemaphore.queueDepth);
        DB_METRICS.record(DB_METRIC_NAMES.inFlight, databaseSemaphore.inFlight);

        try {
            return await callback(prismaClient);
        } finally {
            const durationMs = performance.now() - startedAt;
            DB_METRICS.record(DB_METRIC_NAMES.durationMs, durationMs, { priority });
        }
    });
};

export const usePrismaTransaction = async <T>(callback: (tx: PrismaTransactionClient) => Promise<T>) => {
    return usePrismaClient(async (client) => {
        return client.$transaction(async (tx) => {
            return callback(tx);
        }, {
            // Default Prisma transaction timeouts (maxWait=2s, timeout=5s) are
            // too aggressive for our workload — long save loops (e.g. menu-item
            // modifiers/choices) routinely exceed 5s on slower disks. busy_timeout
            // already prevents lock-contention timeouts; these guard the inner
            // callback's own wall-clock duration.
            maxWait: PRISMA_TRANSACTION_MAX_WAIT_MS,
            timeout: PRISMA_TRANSACTION_TIMEOUT_MS,
        });
    });
}