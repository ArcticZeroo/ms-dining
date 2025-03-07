import { ApplicationContext } from '../constants/context.js';
import { sendVisitFireAndForget } from '../api/tracking/visitors.js';
import Koa from 'koa';
import { ANALYTICS_APPLICATION_NAMES } from '@msdining/common/dist/constants/analytics.js';
import { randomUUID } from 'node:crypto';
import { getTrimmedQueryParam } from '../util/koa.js';

const VISITOR_ID_HEADER = 'X-Visitor-Id';

export const sendVisit = (ctx: Koa.Context, applicationName: string) => {
    if (ApplicationContext.analyticsApplicationsReady.has(applicationName)) {
        const visitorId = ctx.get(VISITOR_ID_HEADER);
        sendVisitFireAndForget(applicationName, visitorId || randomUUID());
    }
}

export const sendVisitMiddleware = (applicationName: string): Koa.Middleware => {
    return (ctx, next) => {
        sendVisit(ctx, applicationName);
        return next();
    }
}

export const sendUniversalVisitMiddleware: Koa.Middleware = (ctx, next) => {
    // Primary is intended to track unique users mainly
    if (ctx.get(VISITOR_ID_HEADER)) {
        sendVisit(ctx, ANALYTICS_APPLICATION_NAMES.primary);
    }

    if (ctx.query.source === 'poster') {
        sendVisit(ctx, ANALYTICS_APPLICATION_NAMES.poster);
    }

    return next();
}

export const sendVisitFromCafeParamMiddleware = (transform: (value: string) => string): Koa.Middleware => {
    return (ctx, next) => {
        const cafeId = ctx.params.id;
        if (typeof cafeId === 'string' && cafeId.length > 0) {
            sendVisit(ctx, transform(cafeId));
        }

        return next();
    }
}

export const sendVisitFromQueryParamMiddleware = (queryParamName: string, transform: (value: string | undefined) => string | undefined): Koa.Middleware => {
    return (ctx, next) => {
        const value = getTrimmedQueryParam(ctx, queryParamName);

        const applicationName = transform(value);
        if (applicationName) {
            sendVisit(ctx, applicationName);
        }

        return next();
    }
}