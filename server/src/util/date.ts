import Duration from '@arcticzeroo/duration';
import Router from '@koa/router';
import { DateUtil } from '@msdining/common';
import { ICafe } from '../models/cafe.js';
import { getTrimmedQueryParam } from './koa.js';

const MENU_REQUEST_DAYS_WINDOW = 30;

export const isDateStringWithinMenuWindow = (dateString: string): boolean => {
    const date = DateUtil.fromDateString(dateString);

    if (Number.isNaN(date.getTime())) {
        return false;
    }

    const timeFromNowMs = Math.abs(Date.now() - date.getTime());
    const daysFromNow = new Duration({ milliseconds: timeFromNowMs }).inDays;

    return daysFromNow <= MENU_REQUEST_DAYS_WINDOW;
};

export const getDateForMenuRequest = (ctx: Router.RouterContext): Date | null => {
    const queryDateRaw = getTrimmedQueryParam(ctx, 'date');
    if (!queryDateRaw) {
        return null;
    }

    const date = DateUtil.fromDateString(queryDateRaw);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const timeFromNowMs = Math.abs(Date.now() - date.getTime());
    const daysFromNow = new Duration({ milliseconds: timeFromNowMs }).inDays;

    if (daysFromNow > MENU_REQUEST_DAYS_WINDOW) {
        return null;
    }

    return date;
};

export const getDateStringForMenuRequest = (ctx: Router.RouterContext): string | null => {
    const date = getDateForMenuRequest(ctx);
    return date ? DateUtil.toDateString(date) : null;
};

export const isCafeAvailable = (cafe: ICafe, date = new Date()) => {
    if (cafe.firstAvailable == null) {
        return true;
    }

    return DateUtil.isDateBefore(cafe.firstAvailable, date);
};

export const isDateValid = (date: Date | null | undefined): date is Date => date != null && !Number.isNaN(date.getTime());

export const needsUpdate = (serverLastUpdateTime: Date, storedLastUpdateTime: Date | undefined | null) => {
    // Shrug, lean towards keeping us up-to-date if we messed something up when parsing the response
    if (!isDateValid(serverLastUpdateTime)) {
        return true;
    }

    // If we've never stored the last update time, we don't know when the last update was... so just update again
    if (!isDateValid(storedLastUpdateTime)) {
        return true;
    }

    return serverLastUpdateTime.getTime() > storedLastUpdateTime.getTime();
}

type ParseDateWithNull = (header: string | undefined | null, allowNull: true) => Date | undefined;
type ParseDateWithoutNull = (header: string | undefined | null, allowNull: false) => Date;
export const parseDateFromLastUpdateHeader: ParseDateWithNull | ParseDateWithoutNull = (header: string | undefined | null, allowNull: boolean): Date | undefined => {
    if (!header) {
        return allowNull ? undefined : new Date(0);
    }

    const date = new Date(header);

    if (!isDateValid(date)) {
        return allowNull ? undefined : new Date(0);
    }

    return date;
}

export const getPaymentProcessorTimezoneOffset = () => {
    const now = new Date();
    const timezoneOffset = -now.getTimezoneOffset();
    const differencePrefix = timezoneOffset >= 0 ? '+' : '-'

    const pad = function(num: number) {
        const norm = Math.floor(Math.abs(num));
        return norm.toString().padStart(2, '0');
    };

    const zeroConcat = function(num: number) {
        const norm = Math.floor(Math.abs(num));
        return norm.toString().padStart(3, '0');
    };

    return now.getFullYear() +
                '-' + pad(now.getMonth() + 1) +
                '-' + pad(now.getDate()) +
                'T' + pad(now.getHours()) +
                ':' + pad(now.getMinutes()) +
                ':' + pad(now.getSeconds()) +
                '.' + zeroConcat(now.getMilliseconds()) +
                differencePrefix + pad(timezoneOffset / 60) +
                ':' + pad(timezoneOffset % 60);
}

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