import { DateUtil } from '@msdining/common';
import { ENVIRONMENT_SETTINGS } from '../../../util/env.js';
import { logInfo } from '../../../util/log.js';
import { populateDailySessionsAsync, scheduleDailyUpdateJob } from './daily.js';
import { DailyCafeUpdateSession } from './update.js';
import { scheduleWeeklyUpdateJob } from './weekly.js';
import { DailyMenuStorageClient } from '../../storage/clients/daily-menu.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { ALL_CAFES } from '../../../constants/cafes.js';
import Duration from '@arcticzeroo/duration';

const repairMissingMenusAsync = async (i: number): Promise<boolean> => {
	const date = DateUtil.getNowWithDaysInFuture(i);

	const cafesWithMenuToday = await DailyMenuStorageClient.getCafesAvailableForDayAsync(DateUtil.toDateString(date));
	if (cafesWithMenuToday.size !== ALL_CAFES.length) {
		logInfo(`Repairing missing menu for ${DateUtil.toDateString(date)}. ${ALL_CAFES.length - cafesWithMenuToday.size} cafe(s) are missing a menu.`);
		const updateSession = new DailyCafeUpdateSession(i);
		await updateSession.populateAsync(cafesWithMenuToday);
		return true;
	}

	logInfo(`No repair needed for ${DateUtil.toDateString(date)}`);
	return false;
}

/**
 * @returns Whether any repair occurred.
 */
const repairMissingWeeklyMenusAsync = async (): Promise<boolean> => {
	if (ENVIRONMENT_SETTINGS.skipWeeklyRepair) {
		return false;
	}

	logInfo('Repairing missing weekly menus...');

	const repairPromises: Array<Promise<boolean>> = [];

	for (const i of DateUtil.yieldDaysInFutureForThisWeek()) {
		repairPromises.push(repairMissingMenusAsync(i));
	}

	const results = await Promise.all(repairPromises);
	return results.some(result => result)
};

/**
 * @returns Whether any repair occurred.
 */
const repairTodaySessionsAsync = async (): Promise<boolean> => {
	const now = new Date();

	// Don't bother repairing today after 2pm if there is already a daily menu;
	// In case I'm making server changes and need to restart the server, I don't
	// want to clear history. There are very few cafes open past 2pm, so we can
	// keep stale data around if we need to.
	if (ENVIRONMENT_SETTINGS.skipDailyRepairIfMenuExists || now.getHours() > 14 || now.getHours() < 6) {
		const isAnyMenuAvailableToday = await DailyMenuStorageClient.isAnyMenuAvailableForDayAsync(DateUtil.toDateString(now));
		if (isAnyMenuAvailableToday) {
			if (ENVIRONMENT_SETTINGS.skipDailyRepairIfMenuExists) {
				logInfo('Skipping repair of today\'s sessions because the menu already exists and environment settings disable update');
				return false;
			}

			logInfo('Skipping repair of today\'s sessions because it is after 3pm and there is already a menu for today');
			return false;
		}
	}

	await populateDailySessionsAsync();
	return true;
};

export const performMenuBootTasks = async () => {
	await MenuItemStorageClient.batchNormalizeMenuItemNamesAsync();

	const didDailyRepair = await repairTodaySessionsAsync();
	const didWeeklyRepair = await repairMissingWeeklyMenusAsync();

	// In case we just did a repair, schedule the associated job with a delay in case that job is about to run.
	const scheduleJob = (job: () => void, didRepair: boolean, name: string) => {
		if (didRepair) {
			logInfo(`Scheduling ${name} job in 30 minutes due to recent repair`);
			setTimeout(() => {
				logInfo(`Scheduling ${name} job after repair delay`);
				job();
			}, new Duration({ minutes: 30 }).inMilliseconds);
		} else {
			job();
		}
	}

	// calculatePatternsInBackground();

	scheduleJob(
		scheduleDailyUpdateJob,
		didDailyRepair,
		'daily update'
	);

	scheduleJob(
		scheduleWeeklyUpdateJob,
		didWeeklyRepair,
		'weekly update'
	);

	// scheduleWeeklyPatternJob();
};