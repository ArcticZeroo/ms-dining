import { AsyncLocalStorage } from 'node:async_hooks';
import { lazy } from '../../shared/util/lazy.js';
import { createProductionServices } from './production.js';
import type { Services } from './types.js';
import type { ICafe } from '../../shared/models/cafe.js';
import type {
    BuyOnDemandClient,
    BuyOnDemandClientOptions,
} from '../../worker/data/cafe/buy-ondemand/buy-ondemand-client.js';

/**
 * Process-wide production services bag, constructed lazily on first read via
 * the codebase's `lazy()` helper. Tests never see these — they wrap their
 * work in `runWithServices(testServices, fn)` instead.
 */
const PRODUCTION_SERVICES = lazy<Services>(createProductionServices);

const servicesStorage = new AsyncLocalStorage<Services>();

let defaultServices: Services | null = null;

/**
 * Sets the process-wide default services bag. When set, getServices()
 * returns this if no ALS-scoped services are active — before falling
 * back to the lazy production singleton.
 */
export const setDefaultServices = (services: Services | null): void => {
    defaultServices = services;
};

/**
 * Returns the active services bag. Resolution order:
 * 1. ALS-scoped services (per-request middleware, runWithServices)
 * 2. Explicit default (set via setDefaultServices)
 * 3. Lazy production singleton
 */
export const getServices = (): Services => {
    return servicesStorage.getStore()
        ?? defaultServices
        ?? PRODUCTION_SERVICES.value;
};

/**
 * Runs `fn` inside an async scope where `getServices()` returns the current
 * services merged with `overrides`. Scope is propagated by AsyncLocalStorage:
 * any await chain started inside `fn` (including HTTP handlers, worker
 * dispatches, etc.) sees the overridden services.
 *
 * Integration tests and Koa request middleware are the main callers.
 */
export const runWithServices = <T>(
    overrides: Partial<Services>,
    fn: () => Promise<T>,
): Promise<T> => {
    const merged: Services = { ...getServices(), ...overrides };
    return servicesStorage.run(merged, fn);
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

