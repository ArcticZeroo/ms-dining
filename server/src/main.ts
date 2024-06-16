import { performMenuBootTasks } from './api/cafe/cache/boot.js';
import { app } from './app.js';
import { webserverPort } from './constants/config.js';
import { logDebug, logError, logInfo } from './util/log.js';
import { createAnalyticsApplications } from './api/tracking/boot.js';
import { ENVIRONMENT_SETTINGS } from './util/env.js';

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
