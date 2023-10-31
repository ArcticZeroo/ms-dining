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

export const getDateStringForMenuRequest = (ctx: Router.RouterContext): string | null => {
    const queryDateRaw = ctx.query.date;
    if (!queryDateRaw || typeof queryDateRaw !== 'string') {
        return null;
    }

    const date = fromDateString(queryDateRaw);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const dateTime = date.getTime();
    const minimumDate = getMinimumDateForMenuRequest();
    const maximumDate = getMaximumDateForMenuRequest();

    if (dateTime < minimumDate.getTime() || dateTime > maximumDate.getTime()) {
        return null;
    }

    return toDateString(new Date(dateTime));
};

export function* yieldDaysInFutureForThisWeek() {
    const now = new Date();
    const startWeekdayIndex = isDateOnWeekend(now)
        ? nativeDayOfWeek.Monday
        : Math.max(now.getDay(), nativeDayOfWeek.Monday);

    for (let i = startWeekdayIndex; i <= nativeDayOfWeek.Friday; i++) {
        yield (i - nativeDayOfWeek.Monday);
    }
}
