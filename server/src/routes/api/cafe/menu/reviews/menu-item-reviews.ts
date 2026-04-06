import Router from '@koa/router';
import { ICreateReviewRequest, REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/models/http';
import { IReviewSummary, IReviewWithComment } from '@msdining/common/models/review';
import { ANALYTICS_APPLICATION_NAMES } from '@msdining/common/constants/analytics';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { isDuckType } from '@arcticzeroo/typeguard';
import { attachRouter, getMaybeUserId, getUserIdOrThrow, isAdminAsync } from '../../../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../../../util/serde.js';
import { sendVisitMiddleware } from '../../../../../middleware/analytics.js';
import { ReviewStorageClient } from '../../../../../api/storage/clients/review.js';
import { MenuItemStorageClient } from '../../../../../api/storage/clients/menu-item.js';
import { requireAuthenticated } from '../../../../../middleware/auth.js';
import { reviewCacheController, serializeReview } from './shared.js';

export const registerMenuItemReviewRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/menu-items/:menuItemId'
    });

    const getMenuItemFromRequest = async (ctx: Router.RouterContext) => {
        const menuItemId = ctx.params.menuItemId;
        if (!menuItemId) {
            ctx.throw(400, 'Missing menu item id');
        }

        const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(menuItemId);
        if (menuItem == null) {
            ctx.throw(404, 'Menu item not found');
        }

        return menuItem;
    }

    router.get('/reviews',
        sendVisitMiddleware(ANALYTICS_APPLICATION_NAMES.getReviews),
        reviewCacheController,
        async ctx => {
            const userId = getMaybeUserId(ctx);
            const menuItem = await getMenuItemFromRequest(ctx);

            const { menuItemReviews, stationReviews } = await ReviewStorageClient.getReviewsForMenuItemAsync(menuItem);

            const response: IReviewSummary = {
                counts:              {},
                reviewsWithComments: [],
                totalCount:          0,
                overallRating:       0,
            };

            const allReviews = [...menuItemReviews, ...stationReviews];

            for (const review of allReviews) {
                response.totalCount += 1;
                response.overallRating += review.rating;
                response.counts[review.rating] = (response.counts[review.rating] || 0) + 1;

                if (review.comment != null && review.comment.trim().length > 0) {
                    const serializedReview = serializeReview(review);
                    serializedReview.comment = review.comment;
                    response.reviewsWithComments.push(serializedReview as IReviewWithComment);
                }
            }

            if (userId != null) {
                const myMenuItemReview = menuItemReviews.find(review => review.menuItemId === menuItem.id && review.userId === userId);
                if (myMenuItemReview) {
                    response.myReview = serializeReview(myMenuItemReview);
                }

                const myStationReview = stationReviews.find(review => review.userId === userId);
                if (myStationReview) {
                    response.myStationReview = serializeReview(myStationReview);
                }
            }

            if (allReviews.length > 0) {
                response.overallRating /= allReviews.length;
            }

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

            const review = await ReviewStorageClient.createMenuItemReviewAsync({
                userId,
                menuItemId:     menuItem.id,
                normalizedName: normalizeNameForSearch(menuItem.name),
                rating:         body.rating,
                comment:        body.comment?.trim(),
                displayName:    isAnonymous ? body.displayName?.trim() : undefined,
                groupId:        menuItem.groupId
            });

            ctx.body = {
                id: review.id
            };

            reviewCacheController.clearCache();
        });

    attachRouter(parent, router);
};
