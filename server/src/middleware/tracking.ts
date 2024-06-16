import { ApplicationContext } from '../constants/context.js';
import { sendVisitFireAndForget } from '../api/tracking/visitors.js';
import Koa from 'koa';
import { ANALYTICS_APPLICATION_NAMES } from '../constants/tracking.js';
import { randomUUID } from 'node:crypto';

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