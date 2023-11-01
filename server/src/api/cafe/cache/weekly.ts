import cron from 'node-cron';
import { logError, logInfo } from '../../../util/log.js';
import { DailyCafeUpdateSession } from './update.js';
import { DateUtil } from '@msdining/common';

const updateWeeklyCafeMenusAsync = async () => {
    logInfo('Updating weekly cafe menus...');
    for (const i of DateUtil.yieldDaysInFutureForThisWeek()) {
        const updateSession = new DailyCafeUpdateSession(i);
        await updateSession.populateAsync();
    }
}

const updateWeeklyCafeMenus = () => {
    updateWeeklyCafeMenusAsync()
        .catch(err => logError('Failed to update weekly cafe menus:', err));
}

export const scheduleWeeklyUpdateJob = () => {
    // Weekly update job runs every Friday at 10:00 AM
    cron.schedule('0 10 * * 5', async () => {
        updateWeeklyCafeMenus();
    });
}