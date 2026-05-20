import Router from '@koa/router';
import { IUpdateReviewRequest, REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/models/http';
import { isDuckType } from '@arcticzeroo/typeguard';
import { attachRouter, getTrimmedQueryParam, getUserIdOrThrow, isAdminAsync } from '../../../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../../../../shared/util/serde.js';
import { getServices } from '../../../../../../main/services/registry.js';
import { requireAuthenticated } from '../../../../../middleware/auth.js';
import { reviewCacheController, serializeReview } from './shared.js';

export const registerReviewCrudRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/reviews'
    });

    const validateReviewOwnershipOrAdminAsync = async (ctx: Router.RouterContext) => {
        const reviewId = ctx.params.reviewId;
        if (!reviewId) {
            ctx.throw(400, 'Missing review id');
        }

        const isAdmin = await isAdminAsync(ctx);
        if (!isAdmin && !(await getServices().data.review.isOwnedByUser({ reviewId, userId: getUserIdOrThrow(ctx) }))) {
            ctx.throw(403, 'Not allowed to modify another user\'s review');
        }

        return reviewId;
    }

    router.get('/mine',
        requireAuthenticated,
        async ctx => {
            const menuItemId = getTrimmedQueryParam(ctx, 'menuItemId');

            if (menuItemId != null) {
                const menuItem = await getServices().data.menuItem.retrieveMenuItem({ id: menuItemId });
                if (menuItem == null) {
                    ctx.throw(400, 'Invalid menu item');
                    return;
                }
            }

            const reviews = await getServices().data.review.getReviewsForUser({
                userId: getUserIdOrThrow(ctx),
                menuItemId
            });

            ctx.body = jsonStringifyWithoutNull(reviews.map(serializeReview));
        });

    router.get('/recent',
        reviewCacheController,
        async ctx => {
            const reviews = await getServices().data.review.getRecentReviews({ count: 10 });
            ctx.body = jsonStringifyWithoutNull(reviews.map(serializeReview));
        });

    router.patch('/:reviewId',
        requireAuthenticated,
        async ctx => {
            const reviewId = await validateReviewOwnershipOrAdminAsync(ctx);

            const body = ctx.request.body;
            if (!isDuckType<IUpdateReviewRequest>(body, {})) {
                ctx.throw(400, 'Invalid update request');
                return;
            }

            if (body.rating != null && (body.rating < 1 || body.rating > 10)) {
                ctx.throw(400, 'Invalid rating');
                return;
            }

            if (body.comment != null && (typeof body.comment !== 'string' || body.comment.length > REVIEW_MAX_COMMENT_LENGTH_CHARS)) {
                ctx.throw(400, 'Invalid review comment');
                return;
            }

            await getServices().data.review.updateReview({
                reviewId,
                update: {
                    rating:      body.rating,
                    comment:     body.comment?.trim(),
                    displayName: body.displayName?.trim(),
                }
            });

            ctx.status = 204;
            reviewCacheController.clearCache();
        });

    router.delete('/:reviewId',
        requireAuthenticated,
        async ctx => {
            const reviewId = await validateReviewOwnershipOrAdminAsync(ctx);
            await getServices().data.review.deleteReview({ reviewId });
            ctx.status = 204;
            reviewCacheController.clearCache();
        });

    attachRouter(parent, router);
};
