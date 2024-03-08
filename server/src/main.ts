import { performMenuBootTasks } from './api/cafe/cache/boot.js';
import { createTrackingApplicationAsync } from './api/tracking/visitors.js';
import { app } from './app.js';
import { webserverPort } from './constants/config.js';
import { ApplicationContext } from './constants/context.js';
import { logDebug, logError, logInfo } from './util/log.js';
import { ENVIRONMENT_SETTINGS } from './util/env.js';

logDebug('Starting in debug mode');
logInfo('Starting server on port', webserverPort);
app.listen(webserverPort);

createTrackingApplicationAsync()
    .then(() => {
        logInfo('User tracking is enabled!');
        ApplicationContext.isReadyForTracking = true;
    })
    .catch(err => {
        if (ENVIRONMENT_SETTINGS.ignoreTrackingFailures) {
            return;
        }

        logError('Could not create tracking application:', err);
    });

performMenuBootTasks()
    .catch(err => logError('Could not perform boot tasks:', err));
