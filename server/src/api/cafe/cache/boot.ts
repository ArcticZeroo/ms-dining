import { getNowWithDaysInFuture, toDateString, yieldDaysInFutureForThisWeek } from '../../../util/date.js';
import { logInfo } from '../../../util/log.js';
import { CafeStorageClient } from '../../storage/cafe.js';
import { populateDailySessionsAsync, scheduleDailyUpdateJob } from './daily.js';
import { DailyCafeUpdateSession } from './update.js';
import { scheduleWeeklyUpdateJob } from './weekly.js';

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

export const performBootTasks = async () => {
	await populateDailySessionsAsync();
	await repairMissingWeeklyMenusAsync();

	scheduleDailyUpdateJob();
	scheduleWeeklyUpdateJob();
};