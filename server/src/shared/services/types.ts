import type { TelemetryClient } from 'applicationinsights';
import type { ICafe } from '../models/cafe.js';
import type { IAiProvider } from '../ai/provider.js';
import type { TranslationCache } from '../buy-ondemand/i18n.js';
import type {
    BuyOnDemandClient,
    BuyOnDemandClientOptions,
} from '../buy-ondemand/buy-ondemand-client.js';
import type { DataServices } from './create-data-services.js';

/**
 * Process-level (or per-scope) service bag. Read via `getServices()`,
 * overridden per async-scope via `runWithServices({...}, fn)`. Tests scope
 * services per integration context; Koa middleware scopes per request.
 */
export interface Services {
    /** Active AI provider: text/vision/embedding. Mock implementation in tests. */
    ai: IAiProvider;
    /** Cache of BoD i18n message maps keyed by cafe id. Per-scope in tests. */
    translations: TranslationCache;
    /**
     * Factory used by `createBuyOnDemandClient(cafe, opts)` (from
     * `services/registry.js`) to build the concrete client. Production
     * returns a real BoD client via `BuyOnDemandClient.createAsync`; tests
     * return a TestBuyOnDemandClient backed by the in-memory test server.
     */
    buyOnDemandFactory: (
        cafe: ICafe,
        options: BuyOnDemandClientOptions,
    ) => Promise<BuyOnDemandClient>;
    /** App Insights client when configured, null otherwise (or in tests). */
    telemetry: TelemetryClient | null;
    /**
     * Typed data-service clients (search-query, menu-item, recommendations, ...).
     * Each forwards through the data handler — in-process in phase 1, cross-
     * thread in phase 2. Tests can stub individual services by spreading
     * `{...defaultDataServices, searchQuery: stub}` into the bag they install.
     */
    data: DataServices;
}
