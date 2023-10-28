import cron from 'node-cron';
import { logError } from '../../../util/log.js';
import { DailyCafeUpdateSession } from './update.js';

const populateDailySessionsAsync = async () => {
    const updateSession = new DailyCafeUpdateSession(0 /*daysInFuture*/);
    await updateSession.populateAsync();
    // what do I do with this information now?
};

const populateDailySessions = () => {
    populateDailySessionsAsync()
        .catch(e => logError('Failed to populate cafe sessions', e));
};

export const scheduleDailyUpdateJob = () => {
    // 3am on Monday through Friday
    cron.schedule('0 3 * * 1,2,3,4,5', () => {
        populateDailySessions();
    });

    populateDailySessions();
}