import { createProductionAi } from '../../worker/data/ai/index.js';
import { BuyOnDemandClient } from '../../worker/data/cafe/buy-ondemand/buy-ondemand-client.js';
import { TranslationCache } from '../../worker/data/cafe/buy-ondemand/i18n.js';
import { getTelemetryClient } from '../../worker/data/telemetry/app-insights.js';
import { defaultDataServices } from './data/index.js';
import type { Services } from './types.js';

/**
 * Builds the production services bag. Called once, lazily, by the services
 * registry on first `getServices()` access. Tests never call this — they
 * construct their own Services object inside `createIntegrationTestContext`.
 *
 * Each line below is one of:
 *   - a call to the owning module's production constructor (`createProductionAi`,
 *     `getTelemetryClient`), OR
 *   - a direct reference to a module's production builder (`BuyOnDemandClient.createAsync`), OR
 *   - a trivial `new` for services with no production-specific construction
 *     (`TranslationCache`).
 *
 * Production-specific logic (env-var parsing, provider composition, BoD login
 * + config init, telemetry connection-string handling) lives in the owning
 * module — this file is intentionally a thin wiring composition.
 */
export const createProductionServices = (): Services => ({
    ai:                 createProductionAi(),
    translations:       new TranslationCache(),
    buyOnDemandFactory: BuyOnDemandClient.createAsync,
    telemetry:          getTelemetryClient(),
    data:               defaultDataServices,
});
