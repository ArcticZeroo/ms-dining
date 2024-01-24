import { ApplicationContext } from '../constants/context.js';
import { sendVisitAsync } from '../api/tracking/visitors.js';
import Koa from 'koa';
import cron from 'node-cron';

const VISITOR_ID_HEADER = 'X-Visitor-Id';
const RECENT_VISITOR_IDS = new Set<string>();

// Clear the set of recent visitor IDs every hour
cron.schedule('0 * * * *', () => {
    RECENT_VISITOR_IDS.clear();
});


export const sendVisitorAnalytics: Koa.Middleware = async (ctx, next) => {
    if (ApplicationContext.isReadyForTracking) {
        const visitorId = ctx.get(VISITOR_ID_HEADER);

        if (visitorId && !RECENT_VISITOR_IDS.has(visitorId)) {
            RECENT_VISITOR_IDS.add(visitorId);

            // Fire and forget, don't block the rest of the request
            sendVisitAsync(visitorId)
                .catch(err => console.log('Failed to send visit for visitor', visitorId, ', error:', err));
        }
    }

    await next();
}