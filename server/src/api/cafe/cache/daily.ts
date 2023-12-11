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
    // We run a weekly update job at 8am, but we'll update again at 10am just in case there were changes.
    // I think (tentatively) that menus are updated by 9am, unclear how accurate they are before then.
    cron.schedule('0 3,10 * * 1,2,3,4,5', () => {
        populateDailySessions();
    });
}