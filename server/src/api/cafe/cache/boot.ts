import { DateUtil } from '@msdining/common';
import { ENVIRONMENT_SETTINGS } from '../../../util/env.js';
import { logError, logInfo } from '../../../util/log.js';
import { CafeStorageClient } from '../../storage/clients/cafe.js';
import { populateDailySessionsAsync, scheduleDailyUpdateJob } from './daily.js';
import { DailyCafeUpdateSession } from './update.js';
import { scheduleWeeklyUpdateJob } from './weekly.js';
import { cafeList } from '../../../constants/cafes.js';
import { DailyMenuStorageClient } from '../../storage/clients/daily-menu.js';
import { isCafeAvailable } from '../../../util/date.js';

const repairMissingWeeklyMenusAsync = async () => {
    if (ENVIRONMENT_SETTINGS.skipWeeklyRepair) {
        return;
    }

    logInfo('Repairing missing weekly menus...');

    let isRepairNeeded = false;
    for (const i of DateUtil.yieldDaysInFutureForThisWeek()) {
        const date = DateUtil.getNowWithDaysInFuture(i);
        const isAnyMenuAvailableToday = await DailyMenuStorageClient.isAnyMenuAvailableForDayAsync(DateUtil.toDateString(date));
        if (!isAnyMenuAvailableToday) {
            isRepairNeeded = true;
            logInfo(`Repairing missing menu for ${DateUtil.toDateString(date)}`);
            const updateSession = new DailyCafeUpdateSession(i);
            await updateSession.populateAsync();
        } else {
            logInfo(`No repair needed for ${DateUtil.toDateString(date)}`);
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
        if (!isCafeAvailable(cafe)) {
            continue;
        }

        const isAnyAllowedMenuAvailable = await DailyMenuStorageClient.isAnyAllowedMenuAvailableForCafe(cafe.id);

        if (isAnyAllowedMenuAvailable) {
            continue;
        }

        isRepairNeeded = true;

        // Clear the cafe from storage in case we have a bad config
        await CafeStorageClient.deleteCafe(cafe.id);

        logInfo(cafe.id, 'is missing allowed menus, attempting to repair...');
        for (const i of DateUtil.yieldDaysInFutureForThisWeek()) {
            try {
                const updateSession = new DailyCafeUpdateSession(i);
                await updateSession.populateAsync([cafe]);
            } catch (err) {
                logError(`Failed to repair ${cafe.id} on ${DateUtil.toDateString(DateUtil.getNowWithDaysInFuture(i))}: ${err}`);
                break;
            }
        }

        const isAnyAllowedMenuAvailableAfterRepair = await DailyMenuStorageClient.isAnyAllowedMenuAvailableForCafe(cafe.id);
        if (!isAnyAllowedMenuAvailableAfterRepair) {
            logError(`Still no menus available for cafe ${cafe.id}. Removing it from the list for now...`);
            // The UpdateSession may have re-added the cafe to storage. Remove it again just in case.
            await CafeStorageClient.deleteCafe(cafe.id);
        }
    }

    if (!isRepairNeeded) {
        logInfo('All cafes have at least one allowed menu!');
    }
}

const repairTodaySessionsAsync = async () => {
    if (ENVIRONMENT_SETTINGS.skipDailyRepair) {
        return;
    }

    const now = new Date();

    // Don't bother repairing today after 5pm if there is already a daily menu;
    // In case I'm making server changes and need to restart the server, I don't
    // want to clear history.
    // if (now.getHours() > 17 || now.getHours() < 6) {
    //     const isAnyMenuAvailableToday = await CafeStorageClient.isAnyMenuAvailableForDayAsync(DateUtil.toDateString(now));
    //     if (isAnyMenuAvailableToday) {
	// 		logInfo('Skipping repair of today\'s sessions because it is after 5pm and there is already a menu for today');
    //         return;
    //     }
    // }

	await populateDailySessionsAsync();
};

export const performBootTasks = async () => {
    await repairTodaySessionsAsync();
    await repairMissingWeeklyMenusAsync();
    await repairCafesWithoutMenusAsync();

    scheduleDailyUpdateJob();
    scheduleWeeklyUpdateJob();
};