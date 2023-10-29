import cron from 'node-cron';
import { logError, logInfo } from '../../../util/log.js';
import { DailyCafeUpdateSession } from './update.js';
import { getNowWithDaysInFuture, isDateOnWeekend, nativeDayOfWeek, toDateString } from '../../../util/date.js';
import { CafeStorageClient } from '../../storage/cafe.js';

function* yieldDaysForThisWeek() {
    const now = new Date();
    const startWeekdayIndex = isDateOnWeekend(now)
        ? nativeDayOfWeek.Monday
        : Math.max(now.getDay(), nativeDayOfWeek.Monday);

    for (let i = startWeekdayIndex; i <= nativeDayOfWeek.Friday; i++) {
        yield i;
    }
}

const updateWeeklyCafeMenusAsync = async () => {
    logInfo('Updating weekly cafe menus...');
    for (const i of yieldDaysForThisWeek()) {
        const updateSession = new DailyCafeUpdateSession(i);
        await updateSession.populateAsync();
    }
}

const updateWeeklyCafeMenus = () => {
    updateWeeklyCafeMenusAsync()
        .catch(err => logError('Failed to update weekly cafe menus:', err));
}

const repairMissingWeeklyMenusAsync = async () => {
    logInfo('Repairing missing weekly menus...');

    let isRepairNeeded = false;
    for (const i of yieldDaysForThisWeek()) {
        const date = getNowWithDaysInFuture(i);
        const isAnyMenuAvailableToday = await CafeStorageClient.isAnyMenuAvailableForDayAsync(toDateString(date));
        if (!isAnyMenuAvailableToday) {
            isRepairNeeded = true;
            logInfo(`Repairing missing menu for ${toDateString(date)}`);
            const updateSession = new DailyCafeUpdateSession(i);
            await updateSession.populateAsync();
        }
    }

    if (!isRepairNeeded) {
        logInfo('No missing weekly menus found');
    }
};

const repairMissingWeeklyMenus = () => {
    repairMissingWeeklyMenusAsync()
        .catch(err => logError('Failed to repair missing weekly menus:', err));
}

export const scheduleWeeklyUpdateJob = () => {
    // Weekly update job runs every Friday at 10:00 AM
    cron.schedule('0 10 * * 5', async () => {
        updateWeeklyCafeMenus();
    });

    repairMissingWeeklyMenus();
}