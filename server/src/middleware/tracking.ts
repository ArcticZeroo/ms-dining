import { ApplicationContext } from '../constants/context.js';
import { sendAnonymousVisitFireAndForget, sendVisitFireAndForget } from '../api/tracking/visitors.js';
import Koa from 'koa';
import cron from 'node-cron';
import { ANALYTICS_APPLICATION_NAMES } from '../constants/tracking.js';
import { randomUUID } from 'node:crypto';

const VISITOR_ID_HEADER = 'X-Visitor-Id';
const RECENT_VISITOR_IDS = new Set<string>();

// Clear the set of recent visitor IDs every hour
cron.schedule('0 * * * *', () => {
    RECENT_VISITOR_IDS.clear();
});

export const sendVisitorAnalytics: Koa.Middleware = (ctx, next) => {
    if (ApplicationContext.analyticsApplicationsReady.has(ANALYTICS_APPLICATION_NAMES.primary)) {
        const visitorId = ctx.get(VISITOR_ID_HEADER);

        if (visitorId && !RECENT_VISITOR_IDS.has(visitorId)) {
            RECENT_VISITOR_IDS.add(visitorId);
            // Don't block the rest of the request
            sendVisitFireAndForget(ANALYTICS_APPLICATION_NAMES.primary, visitorId);
        }
    }

    if (ApplicationContext.analyticsApplicationsReady.has(ANALYTICS_APPLICATION_NAMES.poster) && ctx.query.source === 'poster') {
        sendAnonymousVisitFireAndForget(ANALYTICS_APPLICATION_NAMES.poster);
    }

    return next();
}

export const sendAnonymousAnalytics = (applicationName: string): Koa.Middleware => {
    return async (_, next) => {
        if (ApplicationContext.analyticsApplicationsReady.has(applicationName)) {
            sendVisitFireAndForget(applicationName, randomUUID() /*visitorId*/);
        }

        return next();
    };
}