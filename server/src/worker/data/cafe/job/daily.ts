import cron from 'node-cron';
import { isOfflineModeEnabled } from '../../../../shared/constants/env.js';
import { logError, logInfo } from '../../../../shared/util/log.js';
import { DailyCafeUpdateSession } from './update.js';
import { DateUtil } from '@msdining/common';
import { runWithDbPriority } from '../../../../shared/util/db-priority.js';

export const populateDailySessionsAsync = async () => {
    if (isOfflineModeEnabled) {
        logInfo('Skipping daily update due to offline mode');
    }

    const updateSession = new DailyCafeUpdateSession(0 /*daysInFuture*/);

    if (DateUtil.isDateOnWeekend(updateSession.date)) {
        logInfo('Skipping daily update for weekend');
        return;
    }

    await updateSession.populateAsync();
};

const populateDailySessions = () => {
    populateDailySessionsAsync()
        .catch(error => logError('Failed to populate cafe sessions', error));
};

export const scheduleDailyUpdateJob = () => {
    // Sync every hour from 5am to 5pm on weekdays
    // Weekly job handles 9am on weekdays
    cron.schedule('0 5-8,10-17 * * 1-5', () => {
        runWithDbPriority('background', populateDailySessions);
    });
}