import Duration from '@arcticzeroo/duration';
import { Nullable } from '../models/util.js';

export const addDurationToDate = (date: Date, time: Duration) => {
    const result = new Date(date.getTime());
    result.setMilliseconds(result.getMilliseconds() + time.inMilliseconds);
    return result;
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

export const nativeDayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const isDayOfWeekOnWeekend = (dayOfWeek: number) => dayOfWeek === nativeDayOfWeek.Saturday || dayOfWeek === nativeDayOfWeek.Sunday;

export const nativeMonth = {
    January:   0,
    February:  1,
    March:     2,
    April:     3,
    May:       4,
    June:      5,
    July:      6,
    August:    7,
    September: 8,
    October:   9,
    November:  10,
    December:  11
};

const padDateValue = (value: number) => value.toString().padStart(2, '0');

export const toDateString = (date: Date) => `${date.getFullYear()}-${padDateValue(date.getMonth() + 1)}-${padDateValue(date.getDate())}`;
export const toMaybeDateString = (date?: Date | undefined | null) => date ? toDateString(date) : undefined;
export const fromDateString = (dateString: string) => new Date(`${dateString}T00:00`);
export const getTodayDateString = () => toDateString(new Date());

export const fromMaybeDateString = (value: unknown): Date | null => {
    if (typeof value !== 'string') {
        return null;
    }

    const date = fromDateString(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

const FIRST_WEEKLY_MENUS_TIME = fromDateString('2023-10-31').getTime();

export const isDateOnWeekend = (date: Date) => {
    const dayOfWeek = date.getDay();
    return [nativeDayOfWeek.Saturday, nativeDayOfWeek.Sunday].includes(dayOfWeek);
}

export const getDateWithoutTime = (date: Date) => {
    const result = new Date(date.getTime());
    result.setHours(0, 0, 0, 0);
    return result;
}

export const isSameDate = (a: Date, b: Date) => {
    return getDateWithoutTime(a).getTime() === getDateWithoutTime(b).getTime();
};

export const isDateBefore = (date: Date, compareDate: Date) => {
    return getDateWithoutTime(date).getTime() < getDateWithoutTime(compareDate).getTime();
};

export const isDateAfter = (date: Date, compareDate: Date) => {
    return getDateWithoutTime(date).getTime() > getDateWithoutTime(compareDate).getTime();
};

export const isDateInRangeInclusive = (date: Date, [start, end]: [Date, Date]) => {
    const dateWithoutTime = getDateWithoutTime(date);
    const startWithoutTime = getDateWithoutTime(start);
    const endWithoutTime = getDateWithoutTime(end);

    return dateWithoutTime.getTime() >= startWithoutTime.getTime() && dateWithoutTime.getTime() <= endWithoutTime.getTime();
}

export const getNowWithDaysInFuture = (daysInFuture: number) => {
    const now = new Date();
    now.setDate(now.getDate() + daysInFuture);
    return now;
}

export const getMinimumDateForMenu = (): Date => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();

    let daysSinceMonday = currentDayOfWeek - nativeDayOfWeek.Monday;
    if (daysSinceMonday <= 0) {
        daysSinceMonday += 7;
    }

    now.setDate(now.getDate() - daysSinceMonday);

    const firstWeeklyMenusDate = new Date(FIRST_WEEKLY_MENUS_TIME);
    if (isDateBefore(now, firstWeeklyMenusDate)) {
        return firstWeeklyMenusDate;
    }

    return now;
}

export const getMaximumDateForMenu = (): Date => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();

    let daysUntilFriday = nativeDayOfWeek.Friday - currentDayOfWeek;
    if (daysUntilFriday <= 0) {
        daysUntilFriday += 7;
    }

    now.setDate(now.getDate() + daysUntilFriday);

    return now;
}

export const ensureDateIsNotWeekendForMenu = (date: Date): Date => {
    const dayOfWeek = date.getDay();

    if ([nativeDayOfWeek.Saturday, nativeDayOfWeek.Sunday].includes(dayOfWeek)) {
        let daysUntilMonday = nativeDayOfWeek.Monday - dayOfWeek;
        if (daysUntilMonday <= 0) {
            daysUntilMonday += 7;
        }

        date.setDate(date.getDate() + daysUntilMonday);
    }

    return date;
}

const shouldUseNextWeek = (date: Date) => {
    if (date.getDay() === nativeDayOfWeek.Saturday) {
        return true;
    }

    return date.getDay() === nativeDayOfWeek.Friday && date.getHours() >= 17; // after 5pm on Fridays
}

export const getDaysUntilNextWeekday = (date: Date, targetDay: number, excludeToday: boolean = false) => {
    const daysUntilTargetDay = targetDay - date.getDay();

    if (daysUntilTargetDay < 0 || (daysUntilTargetDay === 0 && excludeToday)) {
        return daysUntilTargetDay + 7;
    }

    return daysUntilTargetDay;
}

export const getDaysSinceLastWeekday = (date: Date, targetDay: number, excludeToday: boolean = false) => {
    const daysSinceTargetDay = date.getDay() - targetDay;

    if (daysSinceTargetDay < 0 || (daysSinceTargetDay === 0 && excludeToday)) {
        return daysSinceTargetDay + 7;
    }

    return daysSinceTargetDay;
}

// On Monday morning, this should yield 0, 1, 2, 3, 4
// On Friday afternoon, this should yield the next week's days, e.g. 3, 4, 5, 6, 7
// On Saturday, this should yield 2, 3, 4, 5, 6
// On Sunday morning, this should yield 1, 2, 3, 4, 5
export function* yieldDaysInFutureForThisWeek(forceUseNextWeek: boolean = false): Iterable<number> {
    const now = new Date();
    const nowWeekday = now.getDay();

    const useNextWeek = forceUseNextWeek || shouldUseNextWeek(now);

    const startDay = useNextWeek
        ? nativeDayOfWeek.Monday
        : Math.max(nativeDayOfWeek.Monday, nowWeekday);

    const daysUntilStartDay = getDaysUntilNextWeekday(now, startDay);

    for (let i = startDay; i <= nativeDayOfWeek.Friday; i++) {
        const daysSinceStartDay = i - startDay;
        const daysFromNow = daysUntilStartDay + daysSinceStartDay;
        yield daysFromNow;
    }
}

export function* yieldDaysThisWeek(forceUseNextWeek: boolean = false) {
    for (const i of yieldDaysInFutureForThisWeek(forceUseNextWeek)) {
        yield getNowWithDaysInFuture(i);
    }
}

export const getDateStringsForWeek = (): string[] => {
    return Array.from(yieldDaysInFutureForThisWeek()).map(i => toDateString(getNowWithDaysInFuture(i)));
}

// Returns weekday date strings for last week + this week + next week (rolling 3-week window)
export const getDateStringsForRollingWindow = (): string[] => {
    const now = new Date();
    const dateStrings: string[] = [];

    // Go back to last week's Monday
    const daysSinceMonday = (now.getDay() + 6) % 7; // 0=Mon -> 0, 1=Tue -> 1, ..., 6=Sun -> 6
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - daysSinceMonday - 7);

    // Generate 3 weeks of weekday dates (Mon-Fri)
    for (let week = 0; week < 3; week++) {
        for (let day = 0; day < 5; day++) {
            const date = new Date(lastMonday);
            date.setDate(lastMonday.getDate() + (week * 7) + day);
            dateStrings.push(toDateString(date));
        }
    }

    return dateStrings;
}

const getSundayForWeek = (date: Date): Date => {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() - result.getDay());
    return getDateWithoutTime(result);
}

export const getMondayForWeek = (date: Date): Date => {
    const result = getSundayForWeek(date);
    result.setDate(result.getDate() + nativeDayOfWeek.Monday);
    return result;
}

export const getFridayForWeek = (date: Date): Date => {
    const result = getSundayForWeek(date);
    result.setDate(result.getDate() + nativeDayOfWeek.Friday);
    return result;
}

export const getWeekdayBounds = (date: Date): [Date, Date] => {
    return [getMondayForWeek(date), getFridayForWeek(date)];
}

export const getWeekdaysForWeek = (date: Date): Date[] => {
    const [start, end] = getWeekdayBounds(date);
    return Array.from(yieldDaysInRange(start, end));
}

/**
 * Inclusive.
 * @param start
 * @param end
 */
export function* yieldDaysInRange(start: Date, end: Date) {
    const currentDate = new Date(start.getTime());

    while (!isDateAfter(currentDate, end)) {
        yield new Date(currentDate.getTime());
        currentDate.setDate(currentDate.getDate() + 1);
    }
}

/**
 * Moves to the last time this weekday occurred, which might be today.
 * @param date
 * @param targetWeekDay
 */
export const moveToMostRecentDay = (date: Date, targetWeekDay: number) => {
    const result = new Date(date.getTime());

    const daysSinceTargetDay = getDaysSinceLastWeekday(result, targetWeekDay);
    result.setDate(result.getDate() - daysSinceTargetDay);

    return result;
}

/**
 * Moves to the next time this weekday occurs, which might be today.
 * @param date
 * @param targetWeekDay
 */
export const moveToNextMostRecentDay = (date: Date, targetWeekDay: number) => {
    const result = new Date(date.getTime());

    const daysUntilTargetDay = getDaysUntilNextWeekday(result, targetWeekDay);
    result.setDate(result.getDate() + daysUntilTargetDay);

    return result;
}

export const getNextWeekday = (date: Date) => {
    const result = new Date(date.getTime());
    result.setDate(result.getDate() + 1);

    if (isDateOnWeekend(result)) {
        result.setDate(result.getDate() + getDaysUntilNextWeekday(result, nativeDayOfWeek.Monday));
    }

    return result;
}

export const getNextDay = (date: Date) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
}

export const getSequentialDateGroups = (dates: Date[], minGroupSizeToAvoidBreakup: number = 0): Array<Array<Date>> => {
    const groups: Array<Array<Date>> = [];
    let currentGroup: Array<Date> = [];

    const ensureGroupIsLargeEnough = () => {
        if (currentGroup.length < minGroupSizeToAvoidBreakup) {
            for (let i = 1; i < currentGroup.length; i++) {
                groups.push([currentGroup[i]]);
            }

            currentGroup.splice(1, currentGroup.length - 1);
        }
    }

    for (const date of dates) {
        if (currentGroup.length < 1) {
            currentGroup = [date];
            groups.push(currentGroup);
            continue;
        }

        const lastDate = currentGroup[currentGroup.length - 1]!;
        if (isSameDate(getNextDay(lastDate), date) || isSameDate(getNextDay(date), lastDate)) {
            currentGroup.push(date);
            continue;
        }

        ensureGroupIsLargeEnough();
        currentGroup = [date];
        groups.push(currentGroup);
    }

    ensureGroupIsLargeEnough();
    return groups;
};

export const DEFAULT_OPENS_AT_MINUTES = 660;   // 11:00 AM
export const DEFAULT_CLOSES_AT_MINUTES = 840;  // 2:00 PM

// Parses a 12-hour time string (e.g. "3:00 pm", "11am", "11:00 AM") to minutes since midnight.
const TIME_REGEX = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;

export const parseTimeToMinutes = (timeStr: string): number | null => {
    const match = timeStr.match(TIME_REGEX);
    if (!match) {
        return null;
    }
    let hours = parseInt(match[1]!);
    const minutes = match[2] != null ? parseInt(match[2]) : 0;
    const period = match[3]!.toLowerCase();
    if (period === 'pm' && hours !== 12) {
        hours += 12;
    }
    if (period === 'am' && hours === 12) {
        hours = 0;
    }
    return hours * 60 + minutes;
};

// Converts minutes since midnight back to a 12-hour time string (e.g. 660 -> "11:00 AM").
export const minutesToTimeString = (totalMinutes: number): string => {
    const hours24 = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    return `${hours12}:${String(mins).padStart(2, '0')} ${period}`;
};

// Returns a Date for today (in the given timezone) with the time set to the given minutes since midnight.
export const minutesToDateToday = (totalMinutes: number, timeZone: string = 'America/Los_Angeles'): Date => {
    const nowInTz = new Date().toLocaleString('en-US', { timeZone });
    const today = new Date(nowInTz);
    today.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    return today;
};

export const getCurrentMinutesSinceMidnight = (timeZone: string = 'America/Los_Angeles'): number => {
    const nowInTz = new Date().toLocaleString('en-US', { timeZone });
    const tzDate = new Date(nowInTz);
    return tzDate.getHours() * 60 + tzDate.getMinutes();
};

export const isCurrentlyPastMinutes = (targetMinutes: number, timeZone: string = 'America/Los_Angeles'): boolean => {
    return getCurrentMinutesSinceMidnight(timeZone) > targetMinutes;
};

const RECENT_OPEN_TIME = new Duration({ days: 14 });

export const getIsRecentlyAvailable = (date: Nullable<Date | string>) => {
	if (!date) {
		return false;
	}

	if (typeof date === 'string') {
		date = fromDateString(date);
	}

	const timeSinceFirstAvailableMs = Date.now() - date.getTime();
	return (timeSinceFirstAvailableMs > 0) && (timeSinceFirstAvailableMs <= RECENT_OPEN_TIME.inMilliseconds);
}
