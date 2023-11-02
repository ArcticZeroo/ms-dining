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

const scheduleWeeklyJobs = (conditions: string[]) => {
    for (const condition of conditions) {
        cron.schedule(condition, updateWeeklyCafeMenus);
    }
}

export const scheduleWeeklyUpdateJob = () => {
    scheduleWeeklyJobs([
        // Try to keep menus up to date the day before
        '0 20 * * 0,1,2,3,4',
        // Ensure that we have menus for next week by EOD on Fridays
        '0 10 * * 5',
        // Each weekday, update all weekly menus to account for any changes
        '0 9 * * 1,2,3,4,5'
    ]);
}