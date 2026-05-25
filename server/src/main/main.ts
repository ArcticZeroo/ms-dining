import { createApp } from './app.js';
import { webserverPort } from '../shared/constants/config.js';
import { logDebug, logError, logInfo } from '../shared/util/log.js';
import { createAnalyticsApplications } from './tracking/boot.js';
import { ENVIRONMENT_SETTINGS } from '../shared/util/env.js';
import { flushTelemetry } from '../shared/telemetry/app-insights.js';
import { shutdownDataHandler } from './services/data/handler.js';
import { getServices, setProductionServicesFactory } from '../shared/services/registry.js';
import { createProductionServices } from './services/production.js';
import * as dotenv from 'dotenv';

dotenv.config();

const handleShutdown = async (signal: string) => {
    logInfo(`${signal} received, shutting down gracefully...`);
    const results = await Promise.allSettled([
        flushTelemetry(),
        shutdownDataHandler(),
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

// Register the production services factory so getServices() can lazily
// construct the production bag on first access. This avoids a static
// import from registry.ts → production.ts which would pull main-thread
// wiring into the worker thread's module graph.
setProductionServicesFactory(createProductionServices);

const app = createApp(getServices());
app.listen(webserverPort);

createAnalyticsApplications()
    .catch(err => {
        if (ENVIRONMENT_SETTINGS.ignoreAnalyticsFailures) {
            return;
        }

        logError('Could not create analytics applications:', err);
    });
