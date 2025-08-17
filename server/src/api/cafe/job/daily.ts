import cron from 'node-cron';
import { logError, logInfo } from '../../../util/log.js';
import { DailyCafeUpdateSession } from './update.js';
import { DateUtil } from '@msdining/common';

export const populateDailySessionsAsync = async () => {
    const updateSession = new DailyCafeUpdateSession(0 /*daysInFuture*/);

    if (DateUtil.isDateOnWeekend(updateSession.date)) {
        logInfo('Skipping daily update for weekend');
        return;
    }

    await updateSession.populateAsync();
};

const populateDailySessions = () => {
    populateDailySessionsAsync()
        .catch(e => logError('Failed to populate cafe sessions', e));
};

export const scheduleDailyUpdateJob = () => {
    // Sync every hour from 5am to 5pm on weekdays
    // Weekly job handles 9am on weekdays
    cron.schedule('0 5-8,10-17 * * 1-5', () => {
        populateDailySessions();
    });
}