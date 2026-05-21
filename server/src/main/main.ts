import { performMenuBootTasks } from '../worker/data/cafe/job/boot.js';
import { createApp } from './app.js';
import { webserverPort } from '../shared/constants/config.js';
import { logDebug, logError, logInfo } from '../shared/util/log.js';
import { createAnalyticsApplications } from '../worker/data/tracking/boot.js';
import { ENVIRONMENT_SETTINGS } from '../shared/util/env.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../worker/queues/embeddings.js';
import { startSearchTagWorkerQueue } from '../worker/queues/search-tags.js';
import { flushTelemetry } from '../worker/data/telemetry/app-insights.js';
import { disconnectPrismaClient } from '../worker/data/storage/client.js';
import { getServices } from './services/registry.js';
import * as dotenv from 'dotenv';

dotenv.config();

const handleShutdown = async (signal: string) => {
    logInfo(`${signal} received, shutting down gracefully...`);
    const results = await Promise.allSettled([
        flushTelemetry(),
        disconnectPrismaClient(),
    ]);
    for (const result of results) {
        if (result.status === 'rejected') {
            logError('Error during graceful shutdown:', result.reason);
        }
    }
    process.exit(0);
};

// pm2 sends SIGINT for graceful restarts; container/host shutdowns send SIGTERM.
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT',  () => handleShutdown('SIGINT'));

logDebug('Starting in debug mode');
logInfo('Starting server on port', webserverPort);

// Build the app with the lazy-initialized production services bag. First
// getServices() call constructs production services via createProductionServices().
const app = createApp(getServices());
app.listen(webserverPort);

createAnalyticsApplications()
    .catch(err => {
        if (ENVIRONMENT_SETTINGS.ignoreAnalyticsFailures) {
            return;
        }

        logError('Could not create analytics applications:', err);
    });

performMenuBootTasks()
    .catch(err => logError('Could not perform boot tasks:', err));

// Start the search-tag worker queue (formerly auto-started on module load).
startSearchTagWorkerQueue();

// Initialize cafe embeddings
logInfo('Adding cafe embeddings to queue...');
EMBEDDINGS_WORKER_QUEUE.addFromCafeGroups();
