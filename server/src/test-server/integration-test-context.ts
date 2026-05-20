/**
 * createIntegrationTestContext — single entry point for setting up the full
 * test environment for an integration test file.
 *
 * Provides:
 *   - A fresh empty SQLite dining.db at a temp path (DATABASE_URL set)
 *   - A fresh empty search.db at a temp path (SEARCH_DB_PATH set)
 *   - A per-context Services bag (mock AI, fresh TranslationCache, test
 *     BuyOnDemand factory, null telemetry) — wired via ALS so production
 *     code calling `getServices()` resolves to these test services
 *   - AppInsights telemetry disabled (APPLICATIONINSIGHTS_CONNECTION_STRING unset)
 *   - A TestBuyOnDemandServer pre-loaded with all generated cafe fixtures
 *
 * Usage (with node:test):
 *
 *   import { before, after, test } from 'node:test';
 *   import { createIntegrationTestContext } from '...';
 *
 *   let ctx;
 *   before(async () => { ctx = await createIntegrationTestContext(); });
 *   after(async () => { await ctx.cleanup(); });
 *
 *   test('does the thing', () => ctx.run(async () => {
 *       // use ctx.server, ctx.mockAi, ctx.dbPath, etc.
 *       // any production code that calls getServices() sees ctx.services
 *   }));
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { disconnectPrismaClient } from '../api/storage/client.js';
import { TranslationCache } from '../api/cafe/buy-ondemand/i18n.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../worker/queues/embeddings.js';
import {
    enterWithServices,
    runWithServices,
} from '../services/registry.js';
import type { Services } from '../services/types.js';
import { applySchemaToTempDb } from './db-test-helper.js';
import { createTestServerWithFixtures } from './fixture-loader.js';
import { TestBuyOnDemandServer } from './index.js';
import { TestBuyOnDemandClient } from './test-client.js';
import { MockAiProvider } from './mock-ai-provider.js';

export interface TestWebserverHandle {
    /** Base URL of the test webserver, e.g. http://127.0.0.1:54321 */
    url: string;
    /** Shut down the webserver. */
    close(): Promise<void>;
}

export interface IntegrationTestContext {
    /** The in-memory BuyOnDemand mock server. */
    server: TestBuyOnDemandServer;
    /** The installed AI provider mock. Use to set overrides or inspect calls. */
    mockAi: MockAiProvider;
    /** Per-context BoD translation cache. Cleared automatically on cleanup. */
    translationCache: TranslationCache;
    /**
     * The Services bag for this context. Production code that calls
     * `getServices()` inside `ctx.run(...)` resolves to this bag.
     * `services.ai === mockAi`, `services.translations === translationCache`.
     */
    services: Services;
    /** Filesystem path to the temp dining.db for this test context. */
    dbPath: string;
    /** Filesystem path to the temp search.db for this test context. */
    searchDbPath: string;
    /**
     * Boots the Koa app on a random free port and returns the base URL.
     * Idempotent — subsequent calls return the existing URL. The webserver
     * is automatically torn down by cleanup().
     */
    startWebserver(): Promise<string>;
    /**
     * Runs `fn` inside a runWithServices(ctx.services, ...) scope. Tests
     * that touch services (AI, translations, BoD client) should wrap their
     * bodies in `ctx.run(...)` so getServices() inside the production code
     * resolves to the test services.
     */
    run<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Calls enterWithServices(ctx.services). Intended for use inside a
     * `beforeEach(() => ctx.installServices())` hook so each test body
     * inherits the services context (node:test's beforeEach callback runs in
     * the parent async resource of the test() body).
     *
     * Strictly an alternative to wrapping every test in `ctx.run(...)` — the
     * net effect is the same. Files that don't touch services don't need
     * either; files that do should pick one pattern and stick with it.
     */
    installServices(): void;
    /** Cleanup: stops webserver, disconnects Prisma, deletes temp dir. */
    cleanup: () => Promise<void>;
}

export async function createIntegrationTestContext(): Promise<IntegrationTestContext> {
    // ── 1. Allocate temp directory ──────────────────────────────────────
    const testId = `test-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const dbDir = path.join(os.tmpdir(), 'ms-dining-tests', testId);
    await fs.promises.mkdir(dbDir, { recursive: true });
    const dbPath = path.join(dbDir, 'dining.db');
    const searchDbPath = path.join(dbDir, 'search.db');

    // ── 2. Set env BEFORE first storage/AI consumer triggers init ──────
    // Both api/storage/client.ts (Prisma) and api/storage/vector/db.ts (vec) are
    // lazy, so as long as no module has triggered their factories yet, setting
    // env here is sufficient.
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SEARCH_DB_PATH = searchDbPath;
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    // ── 3. Push schema to the empty dining.db ───────────────────────────
    await applySchemaToTempDb(dbPath);

    // ── 4. Build per-context services ────────────────────────────────────
    const mockAi = new MockAiProvider();
    const server = createTestServerWithFixtures();
    const translationCache = new TranslationCache();

    const services: Services = {
        ai:                 mockAi,
        translations:       translationCache,
        buyOnDemandFactory: (cafe, options) =>
            TestBuyOnDemandClient.createTestAsync(cafe, server, options),
        telemetry:          null,
    };

    // Belt-and-suspenders: enterWith makes services visible to async work
    // started from the current resource (including most node:test before/test
    // chains in serial execution). ctx.run() additionally guarantees scope
    // for any test that explicitly wraps its body.
    enterWithServices(services);

    // ── 5. Webserver (lazy) ─────────────────────────────────────────────
    let webserver: TestWebserverHandle | null = null;

    const startWebserver = async (): Promise<string> => {
        if (webserver) {
            return webserver.url;
        }
        // Dynamic import so loading the app (which constructs Koa, registers
        // routes, requires the SESSION_SECRET, etc.) only happens for tests
        // that actually exercise HTTP — keeps the smoke test light.
        const { createApp } = await import('../app.js');
        const app = createApp(services);
        const httpServer = http.createServer(app.callback());
        await new Promise<void>((resolve, reject) => {
            httpServer.once('error', reject);
            httpServer.listen(0, '127.0.0.1', () => {
                httpServer.off('error', reject);
                resolve();
            });
        });
        const addr = httpServer.address();
        if (addr == null || typeof addr === 'string') {
            throw new Error('Test webserver did not bind to a TCP port');
        }
        const url = `http://127.0.0.1:${addr.port}`;
        webserver = {
            url,
            close: () => new Promise<void>((resolve, reject) =>
                httpServer.close(err => err ? reject(err) : resolve())),
        };
        return url;
    };

    // ── 6. Cleanup function ─────────────────────────────────────────────
    const cleanup = async (): Promise<void> => {
        if (webserver) {
            try {
                await webserver.close();
            } catch {
                // Best-effort.
            }
            webserver = null;
        }
        try {
            await disconnectPrismaClient();
        } catch {
            // Best-effort: a failed disconnect shouldn't block cleanup.
        }
        // search.db may still be held open by the worker thread; try to remove
        // the whole dir and ignore EBUSY (the OS will reap it once handles are
        // released, and the temp dir is in os.tmpdir() anyway).
        try {
            await fs.promises.rm(dbDir, { recursive: true, force: true });
        } catch {
            // Ignore — best-effort cleanup.
        }
    };

    return {
        server,
        mockAi,
        translationCache,
        services,
        dbPath,
        searchDbPath,
        startWebserver,
        run: <T>(fn: () => Promise<T>) => runWithServices(services, fn),
        installServices: () => enterWithServices(services),
        cleanup,
    };
}

/**
 * Polls EMBEDDINGS_WORKER_QUEUE.remainingItems until it reaches 0 (or the
 * timeout expires). Useful for tests that exercise the search endpoint —
 * searches against unembedded items return nothing.
 *
 * Throws if the queue doesn't drain within timeoutMs.
 */
export async function waitForEmbeddingsQueue(timeoutMs: number = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (EMBEDDINGS_WORKER_QUEUE.remainingItems > 0) {
        if (Date.now() > deadline) {
            throw new Error(
                `Embeddings queue did not drain within ${timeoutMs}ms ` +
                `(${EMBEDDINGS_WORKER_QUEUE.remainingItems} item(s) remaining)`,
            );
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
