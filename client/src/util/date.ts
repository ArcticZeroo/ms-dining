import { DateUtil } from '@msdining/common';

export const getDateDisplay = (date: Date) => date.toLocaleDateString(undefined, {
	weekday: 'long',
	year:    'numeric',
	month:   'long',
	day:     'numeric'
});

export const getWeekdayDisplay = (date: Date) => date.toLocaleDateString(undefined, {
	weekday: 'long'
});

export const getPreviousDay = (date: Date) => {
	const result = new Date(date.getTime());
	result.setDate(result.getDate() - 1);
	return result;
};

export const getNextDay = (date: Date) => {
	const result = new Date(date.getTime());
	result.setDate(result.getDate() + 1);
	return result;
};

const getSequentialDateGroups = (dates: Date[]): Array<Array<Date>> => {
	const groups: Array<Array<Date>> = [];
	let currentGroup: Array<Date> | undefined = undefined;
	for (const date of dates) {
		if (!currentGroup) {
			currentGroup = [date];
			groups.push(currentGroup);
			continue;
		}

		const lastDate = currentGroup[currentGroup.length - 1]!;
		if (DateUtil.isSameDate(getNextDay(lastDate), date)) {
			currentGroup.push(date);
			continue;
		}

		currentGroup = [date];
		groups.push(currentGroup);
	}
	return groups;
};

export const getLocationDatesDisplay = (sortedDates: Date[]) => {
	const groups = getSequentialDateGroups(sortedDates);
	return groups.map(group => {
		if (group.length <= 2) {
			return group.map(getWeekdayDisplay).join(', ');
		}

		const startDateDisplay = getWeekdayDisplay(group[0]);
		const endDateDisplay = getWeekdayDisplay(group[group.length - 1]);
		return `${startDateDisplay} - ${endDateDisplay}`;
	}).join(', ');
};