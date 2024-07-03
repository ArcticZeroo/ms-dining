import { ICafe } from '../../../models/cafe.js';
import {
	getDateWithoutTime,
	getDaysUntilNextWeekday,
	nativeDayOfWeek,
	toDateString
} from '@msdining/common/dist/util/date-util.js';
import { DailyMenuStorageClient } from '../../storage/clients/daily-menu.js';
import { StationStorageClient } from '../../storage/clients/station.js';
import { IAvailabilityPattern } from '@msdining/common/dist/models/pattern.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { logInfo } from '../../../util/log.js';

const WINDOW_WEEK_COUNT = 5;

// TODO: If we start storing cafe schedules, filter out closed cafes (e.g. holidays)
const getPatternDataTimeRange = () => {
	// start date = first monday of 2 months ago
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - 2);
	startDate.setDate(1);
	startDate.setHours(0, 0, 0, 0);

	const daysUntilMonday = getDaysUntilNextWeekday(startDate, nativeDayOfWeek.Monday);
	startDate.setDate(startDate.getDate() + daysUntilMonday);

	// end date = five full weeks later
	const endOfLastMonth = new Date(startDate.getTime());
	// 4 days to get to friday, then (WINDOW_WEEK_COUNT * 7) to add a week to get to the end of the window
	endOfLastMonth.setDate(endOfLastMonth.getDate() + (7 * (WINDOW_WEEK_COUNT - 1)) + 4);

	return [getDateWithoutTime(startDate), getDateWithoutTime(endOfLastMonth)] as const;
};

const calculatePattern = (startTime: Date, availability: Set<string>): IAvailabilityPattern | null => {
	if (availability.size === 0) {
		return null;
	}

	// Step 1: Figure out if the availability is on the same weekday(s) each week when there are visits
	const visitWeekWeekdays: Array<Set<number>> = [];
	let firstVisitDate: Date | null = null;

	for (let weekIndex = 0; weekIndex < WINDOW_WEEK_COUNT; weekIndex++) {
		const visitedWeekdays = new Set<number>();

		const currentDate = new Date(startTime.getTime());
		currentDate.setDate(currentDate.getDate() + (weekIndex * 7));

		for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
			if (availability.has(toDateString(currentDate))) {
				visitedWeekdays.add(currentDate.getDay());

				if (firstVisitDate == null) {
					firstVisitDate = new Date(currentDate.getTime());
				}
			}

			currentDate.setDate(currentDate.getDate() + 1);
		}

		visitWeekWeekdays.push(visitedWeekdays);
	}

	if (firstVisitDate == null) {
		throw new Error('This should never happen - firstVisitDate should be set by the end of the loop');
	}

	let sameWeekdays: Set<number> | null = null;
	const availableWeekIndices: number[] = [];
	for (const [weekIndex, visitedWeekdays] of visitWeekWeekdays.entries()) {
		if (visitedWeekdays.size > 0) {
			availableWeekIndices.push(weekIndex);
		}

		if (sameWeekdays != null) {
			const areSameWeekdays = visitedWeekdays.size === sameWeekdays.size
				&& Array.from(visitedWeekdays)
					.every(weekday => sameWeekdays?.has(weekday) === true);

			if (!areSameWeekdays) {
				// no pattern, very sad
				return null;
			}
		}

		sameWeekdays = visitedWeekdays;
	}

	if (sameWeekdays == null) {
		throw new Error('This should never happen - sameWeekdays should be set by the end of the loop');
	}

	let sameGap = null;
	for (let i = 0; i < availableWeekIndices.length - 1; i++) {
		const currentWeekIndex = availableWeekIndices[i];
		const nextWeekIndex = availableWeekIndices[i + 1];

		// shrug, make typescript happy
		if (currentWeekIndex == null || nextWeekIndex == null) {
			throw new Error('This should never happen');
		}

		const currentGap = nextWeekIndex - currentWeekIndex;

		if (sameGap != null) {
			if (sameGap !== currentGap) {
				// no pattern, very sad
				return null;
			}
		}

		sameGap = currentGap;
	}

	if (sameGap == null) {
		throw new Error('This should never happen - sameGap should be set by the end of the loop');
	}

	return {
		startDate: firstVisitDate,
		weekdays: sameWeekdays,
		gap: sameGap
	};
}

export const calculatePatternsForCafe = async (cafe: ICafe) => {
	const [startTime, endTime] = getPatternDataTimeRange();

	logInfo(`[${cafe.id}] Calculating patterns from `, toDateString(startTime), 'to', toDateString(endTime));
	const availability = await DailyMenuStorageClient.retrieveCafeChildAvailability(cafe.id, startTime, endTime);

	logInfo(`[${cafe.id}] Retrieved availability for ${availability.stationVisitsById.size} stations and ${availability.itemVisitsById.size} items`);

	for (const [stationId, stationAvailability] of availability.stationVisitsById) {
		const pattern = calculatePattern(startTime, stationAvailability);
		await StationStorageClient.setPatternAsync(stationId, pattern);
	}

	for (const [menuItemId, menuItemAvailability] of availability.itemVisitsById) {
		const pattern = calculatePattern(startTime, menuItemAvailability);
		await MenuItemStorageClient.setPatternAsync(menuItemId, pattern);
	}

	logInfo(`[${cafe.id}] Finished calculating patterns`);
}