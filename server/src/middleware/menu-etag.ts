/**
 * Emits a weak ETag derived from the menu watermark for the cafe + date
 * in the request, and short-circuits with a 304 when the client's
 * If-None-Match matches.
 *
 * Layered ABOVE memoizeResponseBodyWithResetOnMenuUpdate so 304s skip the
 * memoize lookup entirely and we never serialize a body that won't be sent.
 *
 * If no watermark exists yet (e.g. server just started, this cafe-day has
 * never had a menuPublished event), the middleware is a no-op pass-through:
 * the downstream route runs normally and the response is uncached at the
 * browser. The next menuPublished event will populate the watermark and
 * subsequent requests will start getting ETags.
 */

import Router from '@koa/router';
import Koa from 'koa';
import { getMenuWatermark } from '../api/cache/menu-watermark.js';
import { getDateStringForMenuRequest } from '../util/date.js';

const formatEtag = (timestamp: number): string => `W/"${timestamp}"`;

export const menuEtagMiddleware = async (ctx: Router.RouterContext, next: Koa.Next) => {
    const cafeId = ctx.params.id?.toLowerCase();
    const dateString = getDateStringForMenuRequest(ctx);
    if (!cafeId || !dateString) {
        await next();
        return;
    }

    const etag = formatEtag(getMenuWatermark(cafeId, dateString));

    if (ctx.get('If-None-Match') === etag) {
        ctx.status = 304;
        ctx.body = null;
        // Set headers after the status so downstream memoize middleware
        // doesn't get a chance to overwrite Cache-Control on the way back.
        ctx.set('ETag', etag);
        ctx.set('Cache-Control', 'no-cache');
        return;
    }

    await next();

    // Apply our headers AFTER the downstream memoize/route runs, so its
    // Cache-Control: public, max-age=... doesn't overwrite ours. Without
    // no-cache, browsers happily serve their own cached body for the
    // max-age window and never revalidate — defeating the point.
    ctx.set('ETag', etag);
    ctx.set('Cache-Control', 'no-cache');
};
