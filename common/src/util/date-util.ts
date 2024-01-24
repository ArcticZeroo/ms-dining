import Duration from '@arcticzeroo/duration';

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
export const fromDateString = (dateString: string) => new Date(`${dateString}T00:00`);

const firstWeeklyMenusTime = fromDateString('2023-10-31').getTime();

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

export const getNowWithDaysInFuture = (daysInFuture: number) => {
    const now = new Date();
    now.setDate(now.getDate() + daysInFuture);
    return now;
}

export const getMinimumDateForMenuRequest = (): Date => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();

    let daysSinceMonday = currentDayOfWeek - nativeDayOfWeek.Monday;
    if (daysSinceMonday <= 0) {
        daysSinceMonday += 7;
    }

    now.setDate(now.getDate() - daysSinceMonday);

    const firstWeeklyMenusDate = new Date(firstWeeklyMenusTime);
    if (isDateBefore(now, firstWeeklyMenusDate)) {
        return firstWeeklyMenusDate;
    }

    return now;
}

export const getMaximumDateForMenuRequest = (): Date => {
    const now = new Date();
    const currentDayOfWeek = now.getDay();

    let daysUntilFriday = nativeDayOfWeek.Friday - currentDayOfWeek;
    if (daysUntilFriday <= 0) {
        daysUntilFriday += 7;
    }

    now.setDate(now.getDate() + daysUntilFriday);

    return now;
}

const shouldUseNextWeek = (date: Date) => {
    if (date.getDay() === nativeDayOfWeek.Saturday) {
        return true;
    }

    return date.getDay() === nativeDayOfWeek.Friday && date.getHours() >= 17; // after 5pm on Fridays
}

export function* yieldDaysInFutureForThisWeek(forceUseNextWeek: boolean = false) {
    const now = new Date();
    const nowWeekday = now.getDay();

    // If it's Saturday, we want to start on Monday of next week
    const dateOffset = forceUseNextWeek || shouldUseNextWeek(now)
        ? 7
        : 0;

    const startWeekdayIndex = isDateOnWeekend(now)
        ? nativeDayOfWeek.Monday
        : Math.max(nowWeekday, nativeDayOfWeek.Monday);

    for (let i = startWeekdayIndex; i <= nativeDayOfWeek.Friday; i++) {
        yield ((i - nowWeekday) + dateOffset);
    }
}

export const getDateStringsForWeek = (): string[] => {
    return Array.from(yieldDaysInFutureForThisWeek()).map(i => toDateString(getNowWithDaysInFuture(i)));
}
