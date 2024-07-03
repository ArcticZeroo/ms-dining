import cron from 'node-cron';
import { logError } from '../../../util/log.js';
import { cafeList } from '../../../constants/cafes.js';
import { calculatePatternsForCafe } from './pattern.js';
import { StationStorageClient } from '../../storage/clients/station.js';
import { ENVIRONMENT_SETTINGS } from '../../../util/env.js';

const calculatePatternsAsync = async () => {
	for (const cafe of cafeList) {
		await calculatePatternsForCafe(cafe);
	}
}

export const calculatePatternsInBackground = () => {
	calculatePatternsAsync()
		.catch(err => logError('Failed to calculate patterns:', err));
}

export const scheduleWeeklyPatternJob = () => {
	// At 5am on every sunday, recalculate patterns
	cron.schedule('0 5 * * 0', calculatePatternsInBackground);
}

export const shouldCalculatePatternsOnBootAsync = async (): Promise<boolean> => {
	if (ENVIRONMENT_SETTINGS.skipPatternRepair) {
		return false;
	}

	const anyStationHasPattern = await StationStorageClient.doesAnyStationHavePatternAsync();
	return !anyStationHasPattern;
};