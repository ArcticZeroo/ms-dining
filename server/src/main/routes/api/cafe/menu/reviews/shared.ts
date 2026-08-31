import Duration from '@arcticzeroo/duration';
import Koa from 'koa';
import { memoizeResponseBody } from '../../../../../middleware/cache.js';
import { assignCacheControl } from '../../../../../util/koa.js';

export { serializeReview } from '../../../../../../shared/models/review.js';

// Anonymous review summaries carry no per-user data, so they are safe to
// share-cache. Authenticated summaries embed the caller's own review, so they
// must be private and are revalidated (max-age 0) instead of served stale —
// this is what lets a just-written review show up immediately on refetch.
const REVIEW_SUMMARY_PUBLIC_CACHE_DURATION = new Duration({ minutes: 5 });

export const assignReviewSummaryCacheControl = (ctx: Koa.Context, userId: string | null): void => {
    const isPublic = userId == null;
    assignCacheControl(ctx, isPublic ? REVIEW_SUMMARY_PUBLIC_CACHE_DURATION : 0, isPublic);
};

// Still memoizes the (user-agnostic) recent-reviews route. Menu-item and
// station summaries are cached in the worker layer and no longer memoized
// here, but review writes clear this so /recent reflects new reviews.
export const reviewCacheController = memoizeResponseBody({ expirationTime: new Duration({ minutes: 5 }), isPublic: true });
