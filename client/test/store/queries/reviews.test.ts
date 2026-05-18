import { IUpdateReviewRequest } from '@msdining/common/models/http';
import { IReview, IReviewSummary } from '@msdining/common/models/review';
import * as assert from 'node:assert';
import { describe, it } from 'vitest';
import { IReviewLookup } from '../../../src/models/reviews.ts';
import {
    buildReview,
    ICreateReviewContext,
    patchReviewFields,
    patchSummaryAddReview,
    patchSummaryRemoveReview,
    patchSummaryUpdateReview,
    recomputeOverallRating,
} from '../../../src/store/queries/reviews.ts';

const makeReview = (overrides: Partial<IReview> = {}): IReview => ({
    id:              'review-1',
    userId:          'user-1',
    userDisplayName: 'Tester',
    menuItemId:      'menu-1',
    menuItemName:    'Burger',
    cafeId:          'cafe-1',
    rating:          8,
    comment:         'great',
    createdDate:     '2024-01-01',
    ...overrides,
});

const emptySummary = (): IReviewSummary => ({
    counts:              {},
    totalCount:          0,
    overallRating:       0,
    reviewsWithComments: [],
});

const menuLookup: IReviewLookup = { menuItemId: 'menu-1', menuItemName: 'Burger' };
const stationLookup: IReviewLookup = { stationId: 'station-1', stationName: 'Grill' };

describe('recomputeOverallRating', () => {
    it('returns 0 for an empty count map', () => {
        assert.strictEqual(recomputeOverallRating({}, 0), 0);
    });

    it('returns the rating when only one rating value is present', () => {
        assert.strictEqual(recomputeOverallRating({ 8: 3 }, 3), 8);
    });

    it('averages across multiple ratings weighted by count', () => {
        // (8*2 + 4*2) / 4 = 6
        assert.strictEqual(recomputeOverallRating({ 8: 2, 4: 2 }, 4), 6);
    });
});

describe('buildReview', () => {
    const context: ICreateReviewContext = {
        userId:          'user-1',
        userDisplayName: 'Tester',
        cafeId:          'cafe-1',
    };

    it('builds a menu item review (logged in)', () => {
        const result = buildReview({
            reviewId: 'r-1',
            lookup:   menuLookup,
            request:  { rating: 10, comment: 'nice' },
            context,
        });
        assert.strictEqual(result.menuItemId, 'menu-1');
        assert.strictEqual(result.menuItemName, 'Burger');
        assert.strictEqual(result.stationId, undefined);
        assert.strictEqual(result.userId, 'user-1');
        assert.strictEqual(result.userDisplayName, 'Tester');
    });

    it('builds a station review (logged in)', () => {
        const result = buildReview({
            reviewId: 'r-1',
            lookup:   stationLookup,
            request:  { rating: 10 },
            context,
        });
        assert.strictEqual(result.stationId, 'station-1');
        assert.strictEqual(result.stationName, 'Grill');
        assert.strictEqual(result.menuItemId, undefined);
    });

    it('strips userId and uses Anonymous when request is anonymous', () => {
        const result = buildReview({
            reviewId: 'r-1',
            lookup:   menuLookup,
            request:  { rating: 8, anonymous: true },
            context,
        });
        assert.strictEqual(result.userId, undefined);
        assert.strictEqual(result.userDisplayName, 'Anonymous');
    });

    it('uses request.displayName when anonymous and a display name is provided', () => {
        const result = buildReview({
            reviewId: 'r-1',
            lookup:   menuLookup,
            request:  { rating: 8, anonymous: true, displayName: 'Visitor' },
            context,
        });
        assert.strictEqual(result.userDisplayName, 'Visitor');
    });
});

describe('patchSummaryAddReview', () => {
    it('increments counts and totalCount', () => {
        const result = patchSummaryAddReview(emptySummary(), makeReview({ rating: 8 }), false, false);
        assert.strictEqual(result.counts[8], 1);
        assert.strictEqual(result.totalCount, 1);
        assert.strictEqual(result.overallRating, 8);
    });

    it('prepends the review to reviewsWithComments when it has a comment', () => {
        const existing = { ...emptySummary(), reviewsWithComments: [makeReview({ id: 'old', comment: 'older' }) as never] };
        const result = patchSummaryAddReview(existing, makeReview({ id: 'new', comment: 'newer' }), false, false);
        assert.strictEqual(result.reviewsWithComments.length, 2);
        assert.strictEqual(result.reviewsWithComments[0]?.id, 'new');
    });

    it('does not add to reviewsWithComments when the review has no comment', () => {
        const result = patchSummaryAddReview(emptySummary(), makeReview({ comment: undefined }), false, false);
        assert.strictEqual(result.reviewsWithComments.length, 0);
    });

    it('sets myReview on a non-anonymous menu item review', () => {
        const review = makeReview();
        const result = patchSummaryAddReview(emptySummary(), review, false /*isStation*/, false /*isAnonymous*/);
        assert.strictEqual(result.myReview?.id, review.id);
        assert.strictEqual(result.myStationReview, undefined);
    });

    it('does not set myReview on anonymous reviews', () => {
        const result = patchSummaryAddReview(emptySummary(), makeReview(), false, true);
        assert.strictEqual(result.myReview, undefined);
        assert.strictEqual(result.myStationReview, undefined);
    });

    it('sets myStationReview on a non-anonymous station review', () => {
        const review = makeReview({ stationId: 'station-1', stationName: 'Grill', menuItemId: undefined, menuItemName: undefined });
        const result = patchSummaryAddReview(emptySummary(), review, true /*isStation*/, false);
        assert.strictEqual(result.myStationReview?.id, review.id);
        assert.strictEqual(result.myReview, undefined);
    });

    it('preserves existing myReview when adding a station review', () => {
        const existingMine = makeReview({ id: 'existing-mine' });
        const summary: IReviewSummary = { ...emptySummary(), myReview: existingMine };
        const stationReview = makeReview({ id: 'station-r', stationId: 'station-1', stationName: 'Grill', menuItemId: undefined });
        const result = patchSummaryAddReview(summary, stationReview, true, false);
        assert.strictEqual(result.myReview?.id, 'existing-mine');
        assert.strictEqual(result.myStationReview?.id, 'station-r');
    });

    // Upsert semantics: the server upserts authenticated reviews, so a "create"
    // call from a user that already has a review must replace counts instead of
    // double-counting.

    it('treats a non-anonymous create as a replacement when myReview already exists', () => {
        const existing = makeReview({ id: 'r-old', rating: 8, comment: 'old' });
        const summary: IReviewSummary = {
            counts:              { 8: 1 },
            totalCount:          1,
            overallRating:       8,
            reviewsWithComments: [existing as never],
            myReview:            existing,
        };
        const replacement = makeReview({ id: 'r-old', rating: 4, comment: 'updated' });

        const result = patchSummaryAddReview(summary, replacement, false /*isStation*/, false /*isAnonymous*/);

        assert.strictEqual(result.totalCount, 1, 'totalCount unchanged on upsert');
        assert.strictEqual(result.counts[8], 0);
        assert.strictEqual(result.counts[4], 1);
        assert.strictEqual(result.reviewsWithComments.length, 1);
        assert.strictEqual(result.reviewsWithComments[0]?.comment, 'updated');
        assert.strictEqual(result.myReview?.comment, 'updated');
    });

    it('treats a non-anonymous station create as a replacement when myStationReview already exists', () => {
        const existing = makeReview({ id: 'r-station', stationId: 'station-1', menuItemId: undefined, rating: 10 });
        const summary: IReviewSummary = {
            counts:              { 10: 1 },
            totalCount:          1,
            overallRating:       10,
            reviewsWithComments: [],
            myStationReview:     existing,
        };
        const replacement = makeReview({ id: 'r-station', stationId: 'station-1', menuItemId: undefined, rating: 6, comment: 'new' });

        const result = patchSummaryAddReview(summary, replacement, true /*isStation*/, false);

        assert.strictEqual(result.totalCount, 1);
        assert.strictEqual(result.counts[10], 0);
        assert.strictEqual(result.counts[6], 1);
        assert.strictEqual(result.myStationReview?.rating, 6);
        assert.strictEqual(result.reviewsWithComments.length, 1, 'comment added when replacement has one');
    });

    it('drops the prior comment entry when replacement removes its comment', () => {
        const existing = makeReview({ id: 'r-1', rating: 8, comment: 'had comment' });
        const summary: IReviewSummary = {
            counts:              { 8: 1 },
            totalCount:          1,
            overallRating:       8,
            reviewsWithComments: [existing as never],
            myReview:            existing,
        };
        const replacement = makeReview({ id: 'r-1', rating: 8, comment: undefined });

        const result = patchSummaryAddReview(summary, replacement, false, false);

        assert.strictEqual(result.reviewsWithComments.length, 0);
    });

    it('anonymous create always adds (server does not upsert anonymous reviews)', () => {
        const existing = makeReview({ id: 'r-old', rating: 8, comment: 'mine' });
        const summary: IReviewSummary = {
            counts:              { 8: 1 },
            totalCount:          1,
            overallRating:       8,
            reviewsWithComments: [existing as never],
            myReview:            existing,
        };
        const anon = makeReview({ id: 'r-anon', userId: undefined, userDisplayName: 'Anonymous', rating: 4 });

        const result = patchSummaryAddReview(summary, anon, false, true /*isAnonymous*/);

        assert.strictEqual(result.totalCount, 2, 'anonymous = pure add');
        assert.strictEqual(result.counts[8], 1);
        assert.strictEqual(result.counts[4], 1);
        assert.strictEqual(result.myReview?.id, 'r-old', 'anon does not clobber my own review');
    });
});

describe('patchReviewFields', () => {
    it('updates rating and rebalances counts when provided', () => {
        const counts: Record<number, number> = { 8: 2 };
        const result = patchReviewFields(makeReview({ rating: 8 }), { rating: 6 } as IUpdateReviewRequest, counts);
        assert.strictEqual(result.rating, 6);
        assert.strictEqual(counts[8], 1);
        assert.strictEqual(counts[6], 1);
    });

    it('updates comment when provided (including empty string clearing)', () => {
        const result1 = patchReviewFields(makeReview({ comment: 'old' }), { comment: 'new' } as IUpdateReviewRequest);
        assert.strictEqual(result1.comment, 'new');

        const result2 = patchReviewFields(makeReview({ comment: 'old' }), { comment: '' } as IUpdateReviewRequest);
        assert.strictEqual(result2.comment, '');
    });

    it('falls back to "Anonymous" when displayName request is empty', () => {
        const result = patchReviewFields(makeReview({ userDisplayName: 'Old' }), { displayName: '' } as IUpdateReviewRequest);
        assert.strictEqual(result.userDisplayName, 'Anonymous');
    });

    it('only updates fields explicitly present in the request', () => {
        const result = patchReviewFields(makeReview({ comment: 'old', rating: 8 }), {} as IUpdateReviewRequest);
        assert.strictEqual(result.comment, 'old');
        assert.strictEqual(result.rating, 8);
    });

    it('is a no-op when rating did not change (does not double-shift counts)', () => {
        const counts: Record<number, number> = { 8: 2 };
        patchReviewFields(makeReview({ rating: 8 }), { rating: 8 } as IUpdateReviewRequest, counts);
        assert.strictEqual(counts[8], 2);
    });
});

describe('patchSummaryUpdateReview', () => {
    it('drops reviews-with-comments entries that lose their comment', () => {
        const summary: IReviewSummary = {
            ...emptySummary(),
            counts:              { 8: 1 },
            totalCount:          1,
            reviewsWithComments: [makeReview({ id: 'r-1', comment: 'old' }) as never],
        };

        const result = patchSummaryUpdateReview(summary, 'r-1', { comment: '' } as IUpdateReviewRequest);

        assert.strictEqual(result.reviewsWithComments.length, 0);
    });

    it('updates myReview and myStationReview if the changed review matches', () => {
        const summary: IReviewSummary = {
            ...emptySummary(),
            counts:          { 8: 1 },
            totalCount:      1,
            myReview:        makeReview({ id: 'r-1', rating: 8 }),
            myStationReview: makeReview({ id: 'r-1', rating: 8 }),
        };

        const result = patchSummaryUpdateReview(summary, 'r-1', { rating: 6 } as IUpdateReviewRequest);

        assert.strictEqual(result.myReview?.rating, 6);
        assert.strictEqual(result.myStationReview?.rating, 6);
    });

    it('rebalances counts when rating changes', () => {
        const summary: IReviewSummary = {
            ...emptySummary(),
            counts:              { 8: 1 },
            totalCount:          1,
            reviewsWithComments: [makeReview({ id: 'r-1', rating: 8, comment: 'c' }) as never],
        };

        const result = patchSummaryUpdateReview(summary, 'r-1', { rating: 4 } as IUpdateReviewRequest);

        assert.strictEqual(result.counts[8], 0);
        assert.strictEqual(result.counts[4], 1);
        assert.strictEqual(result.overallRating, 4);
    });
});

describe('patchSummaryRemoveReview', () => {
    it('removes a review with a comment from reviewsWithComments and decrements counts', () => {
        const summary: IReviewSummary = {
            ...emptySummary(),
            counts:              { 8: 1 },
            totalCount:          1,
            reviewsWithComments: [makeReview({ id: 'r-1', rating: 8, comment: 'c' }) as never],
        };

        const result = patchSummaryRemoveReview(summary, 'r-1');

        assert.strictEqual(result.reviewsWithComments.length, 0);
        assert.strictEqual(result.counts[8], 0);
        assert.strictEqual(result.totalCount, 0);
    });

    it('clears myReview / myStationReview if they match', () => {
        const summary: IReviewSummary = {
            ...emptySummary(),
            counts:          { 8: 1 },
            totalCount:      1,
            myReview:        makeReview({ id: 'r-1', rating: 8 }),
            myStationReview: makeReview({ id: 'r-1', rating: 8 }),
        };

        const result = patchSummaryRemoveReview(summary, 'r-1');

        assert.strictEqual(result.myReview, undefined);
        assert.strictEqual(result.myStationReview, undefined);
    });

    it('finds the deleted review via myReview when not present in reviewsWithComments', () => {
        const summary: IReviewSummary = {
            ...emptySummary(),
            counts:     { 8: 1 },
            totalCount: 1,
            myReview:   makeReview({ id: 'r-1', rating: 8 }),
        };

        const result = patchSummaryRemoveReview(summary, 'r-1');

        assert.strictEqual(result.counts[8], 0);
        assert.strictEqual(result.totalCount, 0);
    });

    it('is safe when the review id is not found anywhere (no counts change)', () => {
        const summary: IReviewSummary = {
            ...emptySummary(),
            counts:     { 8: 1 },
            totalCount: 1,
        };

        const result = patchSummaryRemoveReview(summary, 'unknown');

        assert.strictEqual(result.counts[8], 1);
        assert.strictEqual(result.totalCount, 1);
    });
});

// (no extra imports needed; kept above for documentation)
