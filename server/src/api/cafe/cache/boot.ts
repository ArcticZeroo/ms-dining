import { getNowWithDaysInFuture, toDateString, yieldDaysInFutureForThisWeek } from '../../../util/date.js';
import { logError, logInfo } from '../../../util/log.js';
import { CafeStorageClient } from '../../storage/cafe.js';
import { populateDailySessionsAsync, scheduleDailyUpdateJob } from './daily.js';
import { DailyCafeUpdateSession } from './update.js';
import { scheduleWeeklyUpdateJob } from './weekly.js';
import { cafeList } from '../../../constants/cafes.js';

const repairMissingWeeklyMenusAsync = async () => {
    logInfo('Repairing missing weekly menus...');

    let isRepairNeeded = false;
    for (const i of yieldDaysInFutureForThisWeek()) {
        const date = getNowWithDaysInFuture(i);
        const isAnyMenuAvailableToday = await CafeStorageClient.isAnyMenuAvailableForDayAsync(toDateString(date));
        if (!isAnyMenuAvailableToday) {
            isRepairNeeded = true;
            logInfo(`Repairing missing menu for ${toDateString(date)}`);
            const updateSession = new DailyCafeUpdateSession(i);
            await updateSession.populateAsync();
        } else {
            logInfo(`No repair needed for ${toDateString(date)}`);
        }
    }

    if (!isRepairNeeded) {
        logInfo('No missing weekly menus found');
    }
};

const repairCafesWithoutMenusAsync = async () => {
    logInfo('Checking for cafes without menus...');

    let isRepairNeeded = false;
    for (const cafe of cafeList) {
        const isAnyAllowedMenuAvailable = CafeStorageClient.isAnyAllowedMenuAvailableForCafe(cafe.id);

        if (isAnyAllowedMenuAvailable) {
            continue;
        }

        isRepairNeeded = true;

        // Clear the cafe from storage in case we have a bad config
        await CafeStorageClient.deleteCafe(cafe.id);

        logInfo(cafe.id, 'is missing allowed menus, attempting to repair...');
        for (const i of yieldDaysInFutureForThisWeek()) {
            try {
                const updateSession = new DailyCafeUpdateSession(i);
                await updateSession.populateAsync([cafe]);
            } catch {
                logError(`Failed to repair ${cafe.id}. Removing it from the list for now...`);
                await CafeStorageClient.deleteCafe(cafe.id);
                break;
            }
        }
    }

    if (!isRepairNeeded) {
        logInfo('All cafes have at least one allowed menu!');
    }
}

const repairTodaySessionsAsync = async () => {
    const now = new Date();

    // Don't bother repairing today after 6pm if there is already a daily menu;
    // In case I'm making server changes and need to restart the server, I don't
    // want to clear history.
    if (now.getHours() > 17) {
        const isAnyMenuAvailableToday = await CafeStorageClient.isAnyMenuAvailableForDayAsync(toDateString(now));
        if (isAnyMenuAvailableToday) {
			logInfo('Skipping repair of today\'s sessions because it is after 5pm and there is already a menu for today');
            return;
        }
    }

	await populateDailySessionsAsync();
};

export const performBootTasks = async () => {
    await repairTodaySessionsAsync();
    await repairMissingWeeklyMenusAsync();
    await repairCafesWithoutMenusAsync();

    scheduleDailyUpdateJob();
    scheduleWeeklyUpdateJob();
};