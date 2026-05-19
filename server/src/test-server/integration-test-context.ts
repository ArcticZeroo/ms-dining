/**
 * createIntegrationTestContext — single entry point for setting up the full
 * test environment for an integration test file.
 *
 * Provides:
 *   - A fresh empty SQLite dining.db at a temp path (DATABASE_URL set)
 *   - A fresh empty search.db at a temp path (SEARCH_DB_PATH set)
 *   - MockAiProvider installed as the active AI provider
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
 *   test('does the thing', async () => {
 *       // use ctx.server, ctx.mockAi, ctx.dbPath, etc.
 *   });
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { disconnectPrismaClient } from '../api/storage/client.js';
import { resetAiProvider, setAiProvider } from '../api/ai/index.js';
import { BuyOnDemandClient } from '../api/cafe/buy-ondemand/buy-ondemand-client.js';
import { resetTranslationCache, setTranslationCache, TranslationCache } from '../api/cafe/buy-ondemand/i18n.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../worker/queues/embeddings.js';
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
    /** Cleanup: stops webserver, disconnects Prisma, resets AI, deletes temp dir. */
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

    // ── 4. Install the AI mock provider ─────────────────────────────────
    const mockAi = new MockAiProvider();
    setAiProvider(mockAi);

    // ── 5. Build the BuyOnDemand test server with fixtures ──────────────
    const server = createTestServerWithFixtures();

    // ── 6. Install the BuyOnDemandClient factory ────────────────────────
    // Now any production code that calls BuyOnDemandClient.createAsync(cafe)
    // will receive a TestBuyOnDemandClient backed by the in-memory test server.
    BuyOnDemandClient.setFactory(async (cafe, options) => {
        return TestBuyOnDemandClient.createTestAsync(cafe, server, options);
    });

    // ── 6b. Install a per-context TranslationCache ──────────────────────
    // Each context gets a fresh cache so cross-test pollution is impossible.
    // The default cache (module-level) is reset in cleanup so tests that
    // don't go through createIntegrationTestContext don't leak state either.
    const translationCache = new TranslationCache();
    setTranslationCache(translationCache);

    // ── 7. Webserver (lazy) ─────────────────────────────────────────────
    let webserver: TestWebserverHandle | null = null;

    const startWebserver = async (): Promise<string> => {
        if (webserver) {
            return webserver.url;
        }
        // Dynamic import so loading the app (which constructs Koa, registers
        // routes, requires the SESSION_SECRET, etc.) only happens for tests
        // that actually exercise HTTP — keeps the smoke test light.
        const { app } = await import('../app.js');
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

    // ── 8. Cleanup function ─────────────────────────────────────────────
    const cleanup = async (): Promise<void> => {
        if (webserver) {
            try {
                await webserver.close();
            } catch {
                // Best-effort.
            }
            webserver = null;
        }
        BuyOnDemandClient.setFactory(null);
        try {
            await disconnectPrismaClient();
        } catch {
            // Best-effort: a failed disconnect shouldn't block cleanup.
        }
        resetAiProvider();
        resetTranslationCache();

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
        dbPath,
        searchDbPath,
        startWebserver,
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
