import { performMenuBootTasks } from './api/cafe/cache/boot.js';
import { app } from './app.js';
import { webserverPort } from './constants/config.js';
import { logDebug, logError, logInfo } from './util/log.js';
import { createAnalyticsApplications } from './api/tracking/boot.js';
import { ENVIRONMENT_SETTINGS } from './util/env.js';
import { EMBEDDINGS_WORKER_QUEUE } from './worker/queues/embeddings.js';
import * as dotenv from 'dotenv';

dotenv.config();

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
