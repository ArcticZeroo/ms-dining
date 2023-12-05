import Router from '@koa/router';
import { DateUtil } from '@msdining/common';
import { ICafe } from '../models/cafe.js';

export const getDateStringForMenuRequest = (ctx: Router.RouterContext): string | null => {
    const queryDateRaw = ctx.query.date;

    if (!queryDateRaw || typeof queryDateRaw !== 'string') {
        return null;
    }

    const date = DateUtil.fromDateString(queryDateRaw);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const dateTime = date.getTime();

    if (dateTime < DateUtil.getMinimumDateForMenuRequest().getTime() || dateTime > DateUtil.getMaximumDateForMenuRequest().getTime()) {
        return null;
    }

    return DateUtil.toDateString(new Date(dateTime));
};

export const isCafeAvailable = (cafe: ICafe, date = new Date()) => {
    if (cafe.firstAvailable == null) {
        return true;
    }

    return !DateUtil.isDateBefore(date, cafe.firstAvailable);
};