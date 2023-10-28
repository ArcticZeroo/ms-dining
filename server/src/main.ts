import { app } from './app.js';
import { webserverPort } from './constants/config.js';
import { logInfo } from './util/log.js';
import { createTrackingApplicationAsync } from './api/tracking/visitors.js';
import { ApplicationContext } from './constants/context.js';
import { scheduleDailyUpdateJob } from './api/cafe/cache/daily.js';
import { scheduleWeeklyUpdateJob } from './api/cafe/cache/weekly.js';

logInfo('Starting server on port', webserverPort);
app.listen(webserverPort);

createTrackingApplicationAsync()
    .then(() => {
        ApplicationContext.hasCreatedTrackingApplication = true;
    })
    .catch(err => console.error('Could not create tracking application:', err));

scheduleDailyUpdateJob();
scheduleWeeklyUpdateJob();