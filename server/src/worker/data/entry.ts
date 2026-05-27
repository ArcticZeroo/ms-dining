/**
 * Worker thread entry point for all DB/data operations.
 * Spawned by the main thread's WorkerThreadHandler.
 */
import { InProcessHandler, WorkerThreadHandler } from '../rpc/handler.js';
import { DATA_SERVICES } from './data-services.js';
import { runPendingMigrations } from './runtime-migrations/runner.js';
import { registerDataWorkerEventBridge } from './storage/events.js';
import { createProductionAi } from './ai/index.js';
import { BuyOnDemandClient } from './cafe/buy-ondemand/buy-ondemand-client.js';
import { TranslationCache } from './cafe/buy-ondemand/i18n.js';
import { performMenuBootTasks } from './cafe/job/boot.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../queues/embeddings.js';
import { startSearchTagWorkerQueue } from '../queues/search-tags.js';
import { createDataServices } from '../../shared/services/create-data-services.js';
import { setDefaultServices } from '../../shared/services/registry.js';
import { getTelemetryClient } from '../../shared/telemetry/app-insights.js';
import { logError, logInfo } from '../../shared/util/log.js';
import { ENVIRONMENT_SETTINGS } from '../../shared/util/env.js';

await runPendingMigrations();

const workerDataHandler = new InProcessHandler(DATA_SERVICES, { cloneOverWire: false });
setDefaultServices({
    data:               createDataServices(workerDataHandler),
    ai:                 createProductionAi(),
    translations:       new TranslationCache(),
    buyOnDemandFactory: BuyOnDemandClient.createAsync,
    telemetry:          getTelemetryClient(),
});

registerDataWorkerEventBridge();

// WorkerThreadHandler self-registers as a parentPort listener
// when constructed outside the main thread.
const _handler = new WorkerThreadHandler(new URL(import.meta.url), DATA_SERVICES);

if (!ENVIRONMENT_SETTINGS.skipBootTasks) {
    performMenuBootTasks()
        .catch(err => logError('Could not perform boot tasks:', err));

    startSearchTagWorkerQueue();

    logInfo('Adding cafe embeddings to queue...');
    EMBEDDINGS_WORKER_QUEUE.addFromCafeGroups();
}
