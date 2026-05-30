import { AsyncLocalStorage } from 'node:async_hooks';
import { lazy } from '../util/lazy.js';
import type { Services } from './types.js';
import type { ICafe } from '../models/cafe.js';
import type {
    BuyOnDemandClient,
    BuyOnDemandClientOptions,
} from '../../worker/data/cafe/buy-ondemand/buy-ondemand-client.js';

/**
 * Process-wide production services bag, constructed lazily on first read.
 * Tests never see these — they call setDefaultServices() before any
 * getServices() access.
 *
 * The import of `production.js` is intentionally dynamic (not top-level)
 * to avoid pulling the main-thread wiring (handler.ts, data/index.ts, etc.)
 * into the worker thread's module graph, which would cause a circular-dep
 * deadlock between entry.ts and handler.ts.
 */
let productionServicesFactory: (() => Services) | null = null;

/**
 * Registers the production services factory. Called once from main.ts
 * so that getServices() can fall back to production services on the main
 * thread without a static import from this (shared) module into main/.
 */
export const setProductionServicesFactory = (factory: () => Services): void => {
    productionServicesFactory = factory;
};

const PRODUCTION_SERVICES = lazy<Services>(() => {
    if (productionServicesFactory == null) {
        throw new Error(
            'getServices() called but no services are available. '
            + 'Call setDefaultServices() or setProductionServicesFactory() during initialization.',
        );
    }
    return productionServicesFactory();
});

const servicesStorage = new AsyncLocalStorage<Services>();

let defaultServices: Services | null = null;

/**
 * Sets the process-wide default services bag. When set, getServices()
 * returns this if no ALS-scoped services are active.
 *
 * Must be called before the first getServices() access — both main.ts
 * and the worker entry call this during initialization.
 */
export const setDefaultServices = (services: Services | null): void => {
    defaultServices = services;
};

/**
 * Returns the active services bag. Resolution order:
 * 1. ALS-scoped services (per-request middleware, runWithServices)
 * 2. Explicit default (set via setDefaultServices)
 * 3. Lazy production singleton (registered via setProductionServicesFactory)
 */
export const getServices = (): Services => {
    return servicesStorage.getStore()
        ?? defaultServices
        ?? PRODUCTION_SERVICES.value;
};

/**
 * Runs `callback` inside an async scope where `getServices()` returns the current
 * services merged with `overrides`. Scope is propagated by AsyncLocalStorage:
 * any await chain started inside `callback` (including HTTP handlers, worker
 * dispatches, etc.) sees the overridden services.
 *
 * Integration tests and Koa request middleware are the main callers.
 */
export const runWithServices = <T>(
    overrides: Partial<Services>,
    callback: () => Promise<T>,
): Promise<T> => {
    const merged: Services = { ...getServices(), ...overrides };
    return servicesStorage.run(merged, callback);
};

/**
 * Permanently install `services` for the rest of the current async resource's
 * lifetime. Same semantics as Node's `AsyncLocalStorage#enterWith` — useful
 * in test setup hooks (`before()`) where wrapping every test body in
 * `runWithServices` is awkward and the `before` async context propagates to
 * test bodies in serial node:test execution.
 *
 * Production code should prefer `runWithServices` for clean scope boundaries.
 */
export const enterWithServices = (services: Services): void => {
    servicesStorage.enterWith(services);
};

// ── Convenience helpers ─────────────────────────────────────────────────
//
// These are thin wrappers around `getServices().<svc>` that name the
// operation directly. Use them at callsites where the alternative
// — `getServices().buyOnDemandFactory(cafe, opts)` — reads worse than the
// pre-DI surface (`BuyOnDemandClient.createAsync(cafe, opts)`). Property
// accesses like `getServices().translations` don't need a helper.

/**
 * Build a BuyOnDemandClient routed through the active services bag's
 * factory. Production builds a real client (login + config); tests build a
 * TestBuyOnDemandClient backed by the in-memory test server.
 */
export const createBuyOnDemandClient = (
    cafe: ICafe,
    options: BuyOnDemandClientOptions = {},
): Promise<BuyOnDemandClient> => getServices().buyOnDemandFactory(cafe, options);
