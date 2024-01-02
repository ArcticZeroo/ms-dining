import Duration from '@arcticzeroo/duration';
import Router from '@koa/router';
import { DateUtil } from '@msdining/common';
import { ICafe } from '../models/cafe.js';

const MENU_REQUEST_DAYS_WINDOW = 30;

export const getDateStringForMenuRequest = (ctx: Router.RouterContext): string | null => {
    const queryDateRaw = ctx.query.date;

    if (!queryDateRaw || typeof queryDateRaw !== 'string') {
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

    return DateUtil.toDateString(date);
};

export const isCafeAvailable = (cafe: ICafe, date = new Date()) => {
    if (cafe.firstAvailable == null) {
        return true;
    }

    return !DateUtil.isDateBefore(date, cafe.firstAvailable);
};

export const getDateStringsForWeek = (): string[] => {
    return Array.from(DateUtil.yieldDaysInFutureForThisWeek()).map(i => DateUtil.toDateString(DateUtil.getNowWithDaysInFuture(i)));
}

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