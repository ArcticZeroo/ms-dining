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