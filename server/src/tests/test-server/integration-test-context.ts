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

import { TranslationCache } from '../../worker/data/cafe/buy-ondemand/i18n.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../../worker/queues/embeddings.js';
import {
    enterWithServices,
    runWithServices,
    setDefaultServices,
} from '../../main/services/registry.js';
import type { Services } from '../../main/services/types.js';
import { defaultDataServices } from '../../main/services/data/index.js';
import { createTestServerWithFixtures } from './fixture-loader.js';
import { TestBuyOnDemandServer } from './index.js';
import { TestBuyOnDemandClient } from './test-client.js';
import { MockAiProvider } from './mock-ai-provider.js';
import { createTestUser, TestAuthManager } from './auth-helper.js';
import { createTestDatabase } from './test-database.js';
import { createLazyWebserver } from './test-webserver.js';
import type { IServerUser } from '../../shared/models/auth.js';
import type { ICreateUserInput } from '../../shared/services/user.js';

export type { TestWebserverHandle } from './test-webserver.js';

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
     * Creates a test user in the DB. Shorthand for the auth-helper's
     * `createTestUser()` — call inside `ctx.run(...)` so services resolve.
     */
    createTestUser(overrides?: Partial<ICreateUserInput>): Promise<IServerUser>;
    /**
     * Sends an HTTP request authenticated as `userId`. Lazily creates a
     * session row + unsigned cookie on first use per user, then caches it.
     * The webserver must be started first (`startWebserver()`).
     */
    fetchAs(userId: string, url: string, init?: RequestInit): Promise<Response>;
    /** Cleanup: stops webserver, disconnects Prisma, deletes temp dir. */
    cleanup: () => Promise<void>;
}

export async function createIntegrationTestContext(): Promise<IntegrationTestContext> {
    // ── 1. Database ─────────────────────────────────────────────────────
    const db = await createTestDatabase();

    // ── 2. Services ─────────────────────────────────────────────────────
    const mockAi = new MockAiProvider();
    const server = createTestServerWithFixtures();
    const translationCache = new TranslationCache();

    const services: Services = {
        ai:                 mockAi,
        translations:       translationCache,
        buyOnDemandFactory: (cafe, options) =>
            TestBuyOnDemandClient.createTestAsync(cafe, server, options),
        telemetry:          null,
        data:               defaultDataServices,
    };

    // Belt-and-suspenders: set the test fallback so getServices() works
    // in any async context without per-test installServices() boilerplate.
    // Also enterWith for the current async resource (before() hook scope).
    setDefaultServices(services);
    enterWithServices(services);

    // ── 3. Webserver (lazy) ─────────────────────────────────────────────
    const webserver = createLazyWebserver(services);

    // ── 4. Auth ─────────────────────────────────────────────────────────
    const authManager = new TestAuthManager();

    // ── 5. Cleanup ──────────────────────────────────────────────────────
    const cleanup = async (): Promise<void> => {
        setDefaultServices(null);
        await webserver.cleanup();
        await db.cleanup();
    };

    return {
        server,
        mockAi,
        translationCache,
        services,
        dbPath:       db.dbPath,
        searchDbPath: db.searchDbPath,
        startWebserver: webserver.start,
        run: <T>(fn: () => Promise<T>) => runWithServices(services, fn),
        createTestUser: (overrides) => createTestUser(overrides),
        fetchAs: (userId, url, init) => authManager.fetchAs(userId, url, init),
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
