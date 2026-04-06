import { IReview } from '@msdining/common/models/review';
import { toDateString } from '@msdining/common/util/date-util';
import Duration from '@arcticzeroo/duration';
import { memoizeResponseBody } from '../../../../../middleware/cache.js';
import { IServerReview } from '../../../../../models/review.js';

export const serializeReview = (review: IServerReview): IReview => ({
    id:              review.id,
    userId:          review.userId || undefined,
    userDisplayName: review.displayName ?? review.user?.displayName ?? 'Anonymous',
    menuItemId:      review.menuItemId || undefined,
    menuItemName:    review.menuItem?.name,
    stationId:       review.stationId || undefined,
    stationName:     review.station?.name,
    cafeId:          review.menuItem?.cafe.id ?? review.station?.cafe.id ?? '',
    rating:          review.rating,
    comment:         review.comment || undefined,
    createdDate:     toDateString(review.createdAt),
});

export const reviewCacheController = memoizeResponseBody({ expirationTime: new Duration({ minutes: 5 }), isPublic: true });
