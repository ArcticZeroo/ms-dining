/**
 * Adhoc wrapper to generate the price-history JSON on demand (first population
 * or a manual refresh). The scheduled job normally does this inside the worker,
 * which already has a services bag; a standalone run must set one up itself.
 *
 * Run: cd server && npx tsx src/adhoc/generate-price-history.ts
 */
import * as dotenv from 'dotenv';
import { BuyOnDemandClient } from '../shared/buy-ondemand/buy-ondemand-client.js';
import { setDefaultServices } from '../shared/services/registry.js';
import type { Services } from '../shared/services/types.js';
import { generatePriceHistoryAsync } from '../worker/data/price-history/generate.js';
import { disconnectPrismaClient } from '../worker/data/storage/client.js';

// Load DATABASE_URL for usePrismaClient (adhoc scripts don't go through main.ts).
dotenv.config();

// Minimal services bag: the BoD client needs buyOnDemandFactory + a no-op
// data.cafe.createCafe; telemetry is optional. Booting full production services
// would spawn the worker thread and never exit.
setDefaultServices({
    telemetry:          null,
    buyOnDemandFactory: BuyOnDemandClient.createAsync,
    data:               { cafe: { createCafe: async () => {} } },
} as unknown as Services);

const response = await generatePriceHistoryAsync();
if (response != null) {
    console.log(`Wrote ${Object.keys(response.statsByPair).length} pair(s) for fiscal years ${response.availableYears.join(', ') || '(none)'}`);
}

await disconnectPrismaClient();
