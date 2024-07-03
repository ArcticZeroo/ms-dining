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

    const isBeforeWorkingHours = (new Date()).getHours() < 7;
    await updateSession.populateAsync(isBeforeWorkingHours /*isSlowUpdate*/);
};

const populateDailySessions = () => {
    populateDailySessionsAsync()
        .catch(e => logError('Failed to populate cafe sessions', e));
};

export const scheduleDailyUpdateJob = () => {
    // Lunch menus tend to be finalized for the day after ~9am
    cron.schedule('0 4,10 * * 1,2,3,4,5', () => {
        populateDailySessions();
    });
}