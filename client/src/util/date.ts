import Duration from '@arcticzeroo/duration';

export const addDurationToDate = (date: Date, time: Duration) => {
	const result = new Date(date.getTime());
	result.setMilliseconds(result.getMilliseconds() + time.inMilliseconds);
	return result;
};

export const nativeDayValues = {
	Sunday:    0,
	Monday:    1,
	Tuesday:   2,
	Wednesday: 3,
	Thursday:  4,
	Friday:    5,
	Saturday:  6
};

export const nativeDayOfWeek = {
	Sunday:    0,
	Monday:    1,
	Tuesday:   2,
	Wednesday: 3,
	Thursday:  4,
	Friday:    5,
	Saturday:  6
};

const padDateValue = (value: number) => value.toString().padStart(2, '0');

export const toDateString = (date: Date) => `${date.getFullYear()}-${padDateValue(date.getMonth() + 1)}-${padDateValue(date.getDate())}`;
export const fromDateString = (dateString: string) => new Date(`${dateString}T00:00`);

export const isDateOnWeekend = (date: Date) => {
	const dayOfWeek = date.getDay();
	return [nativeDayOfWeek.Saturday, nativeDayOfWeek.Sunday].includes(dayOfWeek);
};

export const isSameDate = (a: Date, b: Date) => {
	return a.getFullYear() === b.getFullYear()
	       && a.getMonth() === b.getMonth()
	       && a.getDate() === b.getDate();
};

export const isDateBefore = (date: Date, compareDate: Date) => {
	return (date.getFullYear() < compareDate.getFullYear())
	       || (
		       (date.getFullYear() === compareDate.getFullYear())
		       && (
			       date.getMonth() < compareDate.getMonth()
			       || (date.getMonth() === compareDate.getMonth() && date.getDate() < compareDate.getDate())
		       )
	       );
};

export const isDateAfter = (date: Date, compareDate: Date) => {
   return !isSameDate(date, compareDate) && !isDateBefore(date, compareDate);
};

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
		if (isSameDate(getNextDay(lastDate), date)) {
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
		// All week
		// if (group.length === 5 && group[0].getDay() === nativeDayOfWeek.Monday) {
		//     return 'Every Day (M-F)';
		// }

		if (group.length <= 2) {
			return group.map(getWeekdayDisplay).join(', ');
		}

		const startDateDisplay = getWeekdayDisplay(group[0]);
		const endDateDisplay = getWeekdayDisplay(group[group.length - 1]);
		return `${startDateDisplay} - ${endDateDisplay}`;
	}).join(', ');
};