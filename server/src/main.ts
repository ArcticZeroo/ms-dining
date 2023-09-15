import { app } from './app.js';
import { webserverPort } from './constants/config.js';
import { logInfo } from './util/log.js';
import { createTrackingApplicationAsync } from './api/tracking/visitors.js';
import { ApplicationContext } from './constants/context.js';

logInfo('Starting server on port', webserverPort);
app.listen(webserverPort);

createTrackingApplicationAsync()
    .then(() => {
        ApplicationContext.hasCreatedTrackingApplication = true;
    })
    .catch(err => console.error('Could not create tracking application:', err));