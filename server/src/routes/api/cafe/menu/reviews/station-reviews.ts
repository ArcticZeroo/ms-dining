import Router from '@koa/router';
import { ICreateReviewRequest, REVIEW_MAX_COMMENT_LENGTH_CHARS } from '@msdining/common/models/http';
import { IReviewSummary, IReviewWithComment } from '@msdining/common/models/review';
import { isDuckType } from '@arcticzeroo/typeguard';
import { attachRouter, getMaybeUserId, getUserIdOrThrow, isAdminAsync } from '../../../../../util/koa.js';
import { jsonStringifyWithoutNull } from '../../../../../util/serde.js';
import { StationStorageClient } from '../../../../../api/storage/clients/station.js';
import { ReviewStorageClient } from '../../../../../api/storage/clients/review.js';
import { requireAuthenticated } from '../../../../../middleware/auth.js';
import { reviewCacheController, serializeReview } from './shared.js';

export const registerStationReviewRoutes = (parent: Router) => {
    const router = new Router({
        prefix: '/stations/:stationId'
    });

    const getStationFromRequest = async (ctx: Router.RouterContext) => {
        const stationId = ctx.params.stationId;
        if (!stationId) {
            ctx.throw(400, 'Missing station id');
        }

        const station = await StationStorageClient.retrieveStationAsync(stationId);
        if (station == null) {
            ctx.throw(404, 'Station not found');
        }

        return station;
    };

    router.get('/reviews',
        reviewCacheController,
        async ctx => {
            const userId = getMaybeUserId(ctx);
            const station = await getStationFromRequest(ctx);

            const reviews = await ReviewStorageClient.getReviewsForStationAsync(station);

            const response: IReviewSummary = {
                counts:              {},
                reviewsWithComments: [],
                totalCount:          0,
                overallRating:       0,
            };

            for (const review of reviews) {
                response.totalCount += 1;
                response.overallRating += review.rating;
                response.counts[review.rating] = (response.counts[review.rating] || 0) + 1;

                if (review.comment != null && review.comment.trim().length > 0) {
                    const serializedReview = serializeReview(review);
                    serializedReview.comment = review.comment;
                    response.reviewsWithComments.push(serializedReview as IReviewWithComment);
                }

                if (review.stationId === station.id && userId != null && review.userId === userId) {
                    response.myReview = serializeReview(review);
                }
            }

            if (reviews.length > 0) {
                response.overallRating /= reviews.length;
            }

            ctx.body = jsonStringifyWithoutNull(response);
        });

    router.put('/reviews',
        requireAuthenticated,
        async ctx => {
            const station = await getStationFromRequest(ctx);

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

            const review = await ReviewStorageClient.createStationReviewAsync({
                userId,
                stationId:      station.id,
                normalizedName: station.normalizedName,
                rating:         body.rating,
                comment:        body.comment?.trim(),
                displayName:    isAnonymous ? body.displayName?.trim() : undefined,
                groupId:        station.groupId
            });

            ctx.body = {
                id: review.id
            };

            reviewCacheController.clearCache();
        });

    attachRouter(parent, router);
};
