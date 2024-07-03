import cron from 'node-cron';
import { logError, logInfo } from '../../../util/log.js';
import { DailyCafeUpdateSession } from './update.js';
import { DateUtil } from '@msdining/common';

const updateWeeklyCafeMenusAsync = async (forceUseNextWeek: boolean) => {
    logInfo('Updating weekly cafe menus...');
    for (const i of DateUtil.yieldDaysInFutureForThisWeek(forceUseNextWeek)) {
        const updateSession = new DailyCafeUpdateSession(i);
        await updateSession.populateAsync();
    }
}

const updateWeeklyCafeMenus = (forceUseNextWeek: boolean) => {
    updateWeeklyCafeMenusAsync(forceUseNextWeek)
        .catch(err => logError('Failed to update weekly cafe menus:', err));
}

const scheduleWeeklyJobs = (conditions: string[], forceUseNextWeek: boolean) => {
    const job = () => updateWeeklyCafeMenus(forceUseNextWeek);

    for (const condition of conditions) {
        cron.schedule(condition, job);
    }
}

export const scheduleWeeklyUpdateJob = () => {
    scheduleWeeklyJobs([
        // Try to keep menus up to date the day before
        '0 20 * * 0,1,2,3,4',
        // Each weekday (except Friday), update all weekly menus to account for any changes
        // Fridays will be handled by the daily update job.
        '0 9 * * 1,2,3,4'
        // TODO: Ensure that we have menus for next week by EOD on Fridays
    ], false /*forceUseNextWeek*/);

    scheduleWeeklyJobs([
        // Each Friday at 3:30pm, get next week's menus
        '30 16 * * 5'
    ], true /*forceUseNextWeek*/);
}