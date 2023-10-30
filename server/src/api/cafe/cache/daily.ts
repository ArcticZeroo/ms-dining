import cron from 'node-cron';
import { logError, logInfo } from '../../../util/log.js';
import { DailyCafeUpdateSession } from './update.js';
import { isDateOnWeekend } from '../../../util/date.js';

export const populateDailySessionsAsync = async () => {
    const updateSession = new DailyCafeUpdateSession(0 /*daysInFuture*/);

    if (isDateOnWeekend(updateSession.date)) {
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
    // 3am on Monday through Friday
    cron.schedule('0 9 * * 1,2,3,4,5', () => {
        populateDailySessions();
    });
}