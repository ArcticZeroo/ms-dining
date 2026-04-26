import { performMenuBootTasks } from './api/cafe/job/boot.js';
import { app } from './app.js';
import { webserverPort } from './constants/config.js';
import { logDebug, logError, logInfo } from './util/log.js';
import { createAnalyticsApplications } from './api/tracking/boot.js';
import { ENVIRONMENT_SETTINGS } from './util/env.js';
import { EMBEDDINGS_WORKER_QUEUE } from './worker/queues/embeddings.js';
import { flushTelemetry } from './api/telemetry/app-insights.js';
import { disconnectPrismaClient } from './api/storage/client.js';
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

// Initialize cafe embeddings
logInfo('Adding cafe embeddings to queue...');
EMBEDDINGS_WORKER_QUEUE.addFromCafeGroups();
