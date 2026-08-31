import Router, { RouterContext } from '@koa/router';
import { ICreateReviewRequest, REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/models/http';
import { ANALYTICS_APPLICATION_NAMES } from '@msdining/common/constants/analytics';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { isDuckType } from '@arcticzeroo/typeguard';
import { attachRouter, getMaybeUserId, getUserIdOrThrow, isAdminAsync } from '../../../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../../../../shared/util/serde.js';
import { sendVisitMiddleware } from '../../../../../middleware/analytics.js';
import { getServices } from '../../../../../../shared/services/registry.js';
import { requireAuthenticated } from '../../../../../middleware/auth.js';
import { assignReviewSummaryCacheControl, reviewCacheController } from './shared.js';

export const registerMenuItemReviewRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/menu-items/:menuItemId'
    });

    const getMenuItemFromRequest = async (ctx: RouterContext) => {
        const menuItemId = ctx.params.menuItemId;
        if (!menuItemId) {
            ctx.throw(400, 'Missing menu item id');
        }

        const menuItem = await getServices().data.menuItem.retrieveMenuItem({ id: menuItemId });
        if (menuItem == null) {
            ctx.throw(404, 'Menu item not found');
        }

        return menuItem;
    }

    router.get('/reviews',
        sendVisitMiddleware(ANALYTICS_APPLICATION_NAMES.getReviews),
        async ctx => {
            const userId = getMaybeUserId(ctx);
            const menuItem = await getMenuItemFromRequest(ctx);

            const [response, myReviews] = await Promise.all([
                getServices().data.review.retrieveReviewSummary({ menuItem }),
                userId == null
                    ? Promise.resolve(null)
                    : getServices().data.review.getMyReviews({
                        userId,
                        menuItemId: menuItem.id,
                        stationId:  menuItem.stationId,
                    }),
            ]);

            if (myReviews?.menuItemReview != null) {
                response.myReview = myReviews.menuItemReview;
            }

            if (myReviews?.stationReview != null) {
                response.myStationReview = myReviews.stationReview;
            }

            assignReviewSummaryCacheControl(ctx, userId);

            ctx.body = jsonStringifyWithoutNull(response);
        });

    router.put('/reviews',
        requireAuthenticated,
        sendVisitMiddleware(ANALYTICS_APPLICATION_NAMES.postReview),
        async ctx => {
            const menuItem = await getMenuItemFromRequest(ctx);

            const body = ctx.request.body;
            if (!isDuckType<ICreateReviewRequest>(body, { rating: 'number' })) {
                ctx.throw(400, 'Invalid review');
                return;
            }

            if (body.comment != null && (typeof body.comment !== 'string' || body.comment.length > REVIEW_MAX_COMMENT_LENGTH_CHARS)) {
                ctx.throw(400, 'Invalid review comment');
                return;
            }

            if (body.rating < 1 || body.rating > 10) {
                ctx.throw(400, 'Invalid rating');
                return;
            }

            const isAnonymous = body.anonymous === true;
            if (isAnonymous && !(await isAdminAsync(ctx))) {
                ctx.throw(403, 'Only admins can create anonymous reviews');
                return;
            }

            if (!isAnonymous && body.displayName != null) {
                ctx.throw(400, 'displayName is only allowed for anonymous reviews');
                return;
            }

            const userId = isAnonymous ? undefined : getUserIdOrThrow(ctx);

            const review = await getServices().data.review.createMenuItemReview({
                review: {
                    userId,
                    menuItemId:     menuItem.id,
                    normalizedName: normalizeNameForSearch(menuItem.name),
                    rating:         body.rating,
                    comment:        body.comment?.trim(),
                    displayName:    isAnonymous ? body.displayName?.trim() : undefined,
                    groupId:        menuItem.groupId
                }
            });

            ctx.body = {
                id: review.id
            };

            reviewCacheController.clearCache();
        });

    attachRouter(parent, router);
};
