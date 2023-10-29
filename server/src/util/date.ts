import Router from '@koa/router';
import { clamp } from './math.js';

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

const firstWeeklyMenusDate = fromDateString('2023-10-30');

export const isDateOnWeekend = (date: Date) => {
    const dayOfWeek = date.getDay();
    return [nativeDayOfWeek.Saturday, nativeDayOfWeek.Sunday].includes(dayOfWeek);
}

export const isSameDate = (a: Date, b: Date) => {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

export const isDateBefore = (date: Date, compareDate: Date) => {
    return date.getFullYear() < compareDate.getFullYear()
        || date.getMonth() < compareDate.getMonth()
        || date.getDate() < compareDate.getDate();
}

export const isDateAfter = (date: Date, compareDate: Date) => {
    return date.getFullYear() > compareDate.getFullYear()
        || date.getMonth() > compareDate.getMonth()
        || date.getDate() > compareDate.getDate();
}

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

export const getDateStringForMenuRequest = (ctx: Router.RouterContext): string => {
    const now = new Date();
    const queryDateRaw = ctx.query.date;

    if (!queryDateRaw || typeof queryDateRaw !== 'string') {
        return toDateString(now);
    }

    const date = fromDateString(queryDateRaw);
    if (Number.isNaN(date.getTime())) {
        return toDateString(now);
    }

    const dateTime = date.getTime();
    const minimumDate = getMinimumDateForMenuRequest();
    const maximumDate = getMaximumDateForMenuRequest();
    const clampedTime = clamp({
        min: minimumDate.getTime(),
        max: maximumDate.getTime(),
        value: dateTime
    });

    return toDateString(new Date(clampedTime));
};

export function* yieldDaysForThisWeek() {
    const now = new Date();
    const startWeekdayIndex = isDateOnWeekend(now)
        ? nativeDayOfWeek.Monday
        : Math.max(now.getDay(), nativeDayOfWeek.Monday);

    for (let i = startWeekdayIndex; i <= nativeDayOfWeek.Friday; i++) {
        yield i;
    }
}
