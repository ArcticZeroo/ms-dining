import Router, { RouterContext } from '@koa/router';
import { DateUtil } from '@msdining/common';
import { isDateStringWithinMenuWindow } from '../../shared/util/date.js';
import { getTrimmedQueryParam } from './koa.js';

export const getDateForMenuRequest = (ctx: RouterContext): Date | null => {
    const queryDateRaw = getTrimmedQueryParam(ctx, 'date');
    if (!queryDateRaw || !isDateStringWithinMenuWindow(queryDateRaw)) {
        return null;
    }

    const date = DateUtil.fromDateString(queryDateRaw);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const getDateStringForMenuRequest = (ctx: RouterContext): string | null => {
    const date = getDateForMenuRequest(ctx);
    return date ? DateUtil.toDateString(date) : null;
};
