import {
	addDurationToDate,
	fromDateString, getFridayForWeek, getNextWeekday,
	getWeekdaysForWeek,
	moveToMostRecentDay, moveToNextMostRecentDay,
	nativeDayOfWeek, toDateString
} from './date-util.js';
import Duration from '@arcticzeroo/duration';

export interface IGapData {
	gap: number;
	lastVisit: Date;
}

export interface IPatternData {
	allVisits: Date[];
	gapByWeekday: Map<number, IGapData>;
	visitsWithoutPattern: Date[];
	isEveryWeekday: boolean;
	nextExpectedVisit?: Date;
}

const getIsEveryWeekday = (pattern: IPatternData) => {
	return pattern.gapByWeekday.size === 5 && Array.from(pattern.gapByWeekday.values()).every(gapData => gapData.gap === 1);
}

const getWeeksBetween = (date1: Date, date2: Date) => {
	const duration = new Duration({ milliseconds: date2.getTime() - date1.getTime() });
	return Math.round(duration.inDays / 7);
}

const calculateRegularWeeklyGap = (dates: Date[]): IGapData | null => {
	if (dates.length < 2) {
		return null;
	}

	dates.sort((a, b) => a.getTime() - b.getTime());

	const weeklyGap = getWeeksBetween(dates[0], dates[1]);
	for (let i = 1; i < dates.length; i++) {
		const gap = getWeeksBetween(dates[i - 1], dates[i]);
		if (gap !== weeklyGap) {
			return null;
		}
	}

	return {
		gap: weeklyGap,
		lastVisit: dates[dates.length - 1]
	};
}

const calculateNextExpectedVisit = (pattern: IPatternData): Date | null => {
	if (pattern.isEveryWeekday) {
		return getNextWeekday(new Date());
	}

	let closestVisit: Date | null = null;
	let closestVisitTime = Infinity;
	for (const [, gapData] of pattern.gapByWeekday) {
		const nextGapVisit = addDurationToDate(gapData.lastVisit, new Duration({ days: gapData.gap * 7 }));
		if (nextGapVisit.getTime() < closestVisitTime) {
			closestVisit = nextGapVisit;
			closestVisitTime = nextGapVisit.getTime();
		}
	}

	return closestVisit;
}

export const calculatePattern = (visitDateStrings: string[]): IPatternData => {
	const visitDates = Array.from(visitDateStrings).map(fromDateString);

	const pattern: IPatternData = {
		allVisits: visitDates,
		gapByWeekday: new Map(),
		visitsWithoutPattern: [],
		isEveryWeekday: false
	};

	const visitsByWeekday = new Map<number, Set<Date>>();
	for (const date of visitDates) {
		const weekday = date.getDay();
		const weekdayVisits = visitsByWeekday.get(weekday) || new Set<Date>();
		weekdayVisits.add(date);
		visitsByWeekday.set(weekday, weekdayVisits);
	}

	for (const [weekday, visits] of visitsByWeekday) {
		const regularGap = calculateRegularWeeklyGap(Array.from(visits));
		if (regularGap != null) {
			pattern.gapByWeekday.set(weekday, regularGap);
		} else {
			pattern.visitsWithoutPattern.push(...visits);
		}
	}

	pattern.isEveryWeekday = getIsEveryWeekday(pattern);
	pattern.nextExpectedVisit = calculateNextExpectedVisit(pattern);

	return pattern;
}