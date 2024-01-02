import { performBootTasks } from './api/cafe/cache/boot.js';
import { createTrackingApplicationAsync } from './api/tracking/visitors.js';
import { app } from './app.js';
import { webserverPort } from './constants/config.js';
import { ApplicationContext } from './constants/context.js';
import { logError, logInfo } from './util/log.js';
import { ENVIRONMENT_SETTINGS } from './util/env.js';

logInfo('Starting server on port', webserverPort);
app.listen(webserverPort);

createTrackingApplicationAsync()
    .then(() => {
        ApplicationContext.hasCreatedTrackingApplication = true;
    })
    .catch(err => {
        if (ENVIRONMENT_SETTINGS.ignoreTrackingFailures) {
            return;
        }

        logError('Could not create tracking application:', err);
    });

performBootTasks()
    .catch(err => logError('Could not perform boot tasks:', err));
