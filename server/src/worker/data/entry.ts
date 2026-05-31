/**
 * Worker thread entry point for all DB/data operations.
 * Spawned by the main thread's WorkerThreadHandler.
 */
import { InProcessHandler, WorkerThreadHandler } from '../rpc/handler.js';
import { DATA_SERVICES } from './data-services.js';
import { runPendingMigrations } from './runtime-migrations/runner.js';
import { createProductionAi } from '../../shared/ai/index.js';
import type { IAiProvider } from '../../shared/ai/provider.js';
import { BuyOnDemandClient } from '../../shared/buy-ondemand/buy-ondemand-client.js';
import { TranslationCache } from '../../shared/buy-ondemand/i18n.js';
import { performMenuBootTasks } from './cafe/job/boot.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../queues/embeddings.js';
import { startSearchTagWorkerQueue } from '../queues/search-tags.js';
import { createDataServices } from '../../shared/services/create-data-services.js';
import { setDefaultServices } from '../../shared/services/registry.js';
import { getTelemetryClient } from '../../shared/telemetry/app-insights.js';
import { logError, logInfo } from '../../shared/util/log.js';
import { ENVIRONMENT_SETTINGS, isTestEnvironment } from '../../shared/util/env.js';

await runPendingMigrations();

const throwingAiProvider: IAiProvider = {
    retrieveTextCompletion() {
        throw new Error('AI provider not available in test worker — use MockAiProvider via services');
    },
    retrieveVisionCompletion() {
        throw new Error('AI provider not available in test worker — use MockAiProvider via services');
    },
    retrieveEmbedding() {
        throw new Error('AI provider not available in test worker — use MockAiProvider via services');
    },
};

const workerDataHandler = new InProcessHandler(DATA_SERVICES, { cloneOverWire: false });
setDefaultServices({
    data:               createDataServices(workerDataHandler),
    ai:                 isTestEnvironment ? throwingAiProvider : createProductionAi(),
    translations:       new TranslationCache(),
    buyOnDemandFactory: BuyOnDemandClient.createAsync,
    telemetry:          getTelemetryClient(),
});

registerDataWorkerEventBridge();

import { type DbPriority, runWithDbPriority } from '../../shared/util/db-priority.js';
import { registerDataWorkerEventBridge } from '../../shared/util/events.js';

// WorkerThreadHandler self-registers as a parentPort listener
// when constructed outside the main thread.
const _handler = new WorkerThreadHandler(new URL(import.meta.url), DATA_SERVICES, {
    dispatchMiddleware: (metadata, run) => {
        const priority = metadata?.dbPriority as DbPriority | undefined;
        return priority ? runWithDbPriority(priority, run) : run();
    },
});

if (!ENVIRONMENT_SETTINGS.skipBootTasks) {
    performMenuBootTasks()
        .catch(err => logError('Could not perform boot tasks:', err));

    startSearchTagWorkerQueue();

    logInfo('Adding cafe embeddings to queue...');
    EMBEDDINGS_WORKER_QUEUE.addFromCafeGroups();
}
