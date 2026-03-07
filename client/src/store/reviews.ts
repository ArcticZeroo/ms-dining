import { ICreateReviewRequest, IUpdateReviewRequest } from '@msdining/common/models/http';
import { IReview, IReviewSummary, IReviewWithComment } from '@msdining/common/models/review';
import { DiningClient } from '../api/client/dining.ts';
import { LazyResource } from './lazy.ts';
import { toDateString } from '@msdining/common/util/date-util';
import { IReviewLookup, isStationReview, getReviewEntityId, getReviewEntityName } from '../models/reviews.ts';

const EVICTION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const EVICTION_MAX_IDLE_MS = 10 * 60 * 1000;
const RECENT_REVIEWS_COUNT = 10;

interface ICreateReviewContext {
    userId?: string;
    userDisplayName: string;
    cafeId: string;
}

const recomputeOverallRating = (counts: Record<number, number>, totalCount: number): number => {
    if (totalCount === 0) {
        return 0;
    }

    let sum = 0;
    for (const [rating, count] of Object.entries(counts)) {
        sum += Number(rating) * count;
    }
    return sum / totalCount;
};

class ReviewStore {
    readonly #reviewsByEntityId = new Map<string, LazyResource<IReviewSummary>>();
    readonly #recentReviews = new LazyResource<Array<IReview>>(() => DiningClient.getRecentReviews());
    readonly #myReviews = new LazyResource<Array<IReview>>(() => DiningClient.retrieveMyReviews());

    constructor() {
        setInterval(() => this.#evictStaleEntries(), EVICTION_CHECK_INTERVAL_MS);
    }

    #getOrCreateResource(lookup: IReviewLookup): LazyResource<IReviewSummary> {
        const entityId = getReviewEntityId(lookup);
        let resource = this.#reviewsByEntityId.get(entityId);
        if (!resource) {
            resource = new LazyResource(() => DiningClient.retrieveReviews(lookup));
            this.#reviewsByEntityId.set(entityId, resource);
        }
        return resource;
    }

    #evictStaleEntries() {
        const now = Date.now();
        for (const [entityId, resource] of this.#reviewsByEntityId) {
            if (now - resource.lastAccessed > EVICTION_MAX_IDLE_MS) {
                this.#reviewsByEntityId.delete(entityId);
            }
        }
    }

    #updateRecentReviews(updater: (reviews: IReview[]) => IReview[]) {
        return this.#recentReviews.updateExisting(
            (current) => updater(current)
        );
    }

    #updateMyReviews(updater: (reviews: IReview[]) => IReview[]) {
        return this.#myReviews.updateExisting(
            (current) => updater(current)
        );
    }

    getReviews(lookup: IReviewLookup) {
        return this.#getOrCreateResource(lookup).get();
    }

    get recentReviews() {
        return this.#recentReviews.get();
    }

    get myReviews() {
        return this.#myReviews.get();
    }

    async createReview(lookup: IReviewLookup, request: ICreateReviewRequest, context: ICreateReviewContext): Promise<string> {
        const reviewId = await DiningClient.createReview(lookup, request);
        const entityId = getReviewEntityId(lookup);
        const isStation = isStationReview(lookup);

        const review: IReview = {
            id:              reviewId,
            userId:          request.anonymous ? undefined : context.userId,
            userDisplayName: request.anonymous ? (request.displayName || 'Anonymous') : context.userDisplayName,
            menuItemId:      isStation ? undefined : entityId,
            menuItemName:    isStation ? undefined : getReviewEntityName(lookup),
            stationId:       isStation ? entityId : undefined,
            stationName:     isStation ? getReviewEntityName(lookup) : undefined,
            cafeId:          context.cafeId,
            rating:          request.rating,
            comment:         request.comment,
            createdDate:     toDateString(new Date()),
        };

        const resource = this.#reviewsByEntityId.get(entityId);
        await resource?.updateExisting((current) => {
            const counts = { ...current.counts };
            counts[request.rating] = (counts[request.rating] ?? 0) + 1;
            const totalCount = current.totalCount + 1;

            const reviewsWithComments = review.comment
                ? [review as IReviewWithComment, ...current.reviewsWithComments]
                : [...current.reviewsWithComments];

            return {
                counts,
                totalCount,
                overallRating:    recomputeOverallRating(counts, totalCount),
                reviewsWithComments,
                myReview:         request.anonymous ? current.myReview : review,
            };
        });

        await this.#updateRecentReviews((recent) => {
            const filtered = recent.filter((existing) => (existing.menuItemId ?? existing.stationId) !== entityId);
            return [review, ...filtered].slice(0, RECENT_REVIEWS_COUNT);
        });

        if (!request.anonymous) {
            await this.#updateMyReviews((mine) => {
                const filtered = mine.filter((existing) => (existing.menuItemId ?? existing.stationId) !== entityId);
                return [review, ...filtered];
            });
        }

        return reviewId;
    }

    async updateReview(reviewId: string, lookup: IReviewLookup, request: IUpdateReviewRequest): Promise<void> {
        await DiningClient.updateReview(reviewId, request);

        const entityId = getReviewEntityId(lookup);
        const resource = this.#reviewsByEntityId.get(entityId);
        await resource?.updateExisting((current) => {
            const counts = { ...current.counts };
            let myReview = current.myReview;

            const updateReviewFields = (existing: IReview): IReview => {
                const updated = { ...existing };
                if (request.rating != null && request.rating !== existing.rating) {
                    counts[existing.rating] = (counts[existing.rating] ?? 1) - 1;
                    counts[request.rating] = (counts[request.rating] ?? 0) + 1;
                    updated.rating = request.rating;
                }
                if (request.comment !== undefined) {
                    updated.comment = request.comment;
                }
                if (request.displayName !== undefined) {
                    updated.userDisplayName = request.displayName || 'Anonymous';
                }
                return updated;
            };

            const reviewsWithComments = current.reviewsWithComments.flatMap((review) => {
                if (review.id !== reviewId) {
                    return [review];
                }
                const updated = updateReviewFields(review);
                if (!updated.comment) {
                    return [];
                }
                return [updated as IReviewWithComment];
            });

            if (myReview?.id === reviewId) {
                myReview = updateReviewFields(myReview);
            }

            return {
                counts,
                totalCount:    current.totalCount,
                overallRating: recomputeOverallRating(counts, current.totalCount),
                reviewsWithComments,
                myReview,
            };
        });

        const patchReview = (review: IReview): IReview => {
            const updated = { ...review };
            if (request.rating != null) {
                updated.rating = request.rating;
            }
            if (request.comment !== undefined) {
                updated.comment = request.comment;
            }
            if (request.displayName !== undefined) {
                updated.userDisplayName = request.displayName || 'Anonymous';
            }
            return updated;
        };

        await this.#updateRecentReviews((recent) =>
            recent.map((review) => review.id === reviewId ? patchReview(review) : review)
        );

        await this.#updateMyReviews((mine) =>
            mine.map((review) => review.id === reviewId ? patchReview(review) : review)
        );
    }

    async deleteReview(reviewId: string, lookup: IReviewLookup): Promise<void> {
        await DiningClient.deleteReview(reviewId);

        const entityId = getReviewEntityId(lookup);
        const resource = this.#reviewsByEntityId.get(entityId);
        await resource?.updateExisting((current) => {
            const deletedReview = current.reviewsWithComments.find((review) => review.id === reviewId)
                ?? (current.myReview?.id === reviewId ? current.myReview : undefined);

            const counts = { ...current.counts };
            let totalCount = current.totalCount;

            if (deletedReview) {
                counts[deletedReview.rating] = (counts[deletedReview.rating] ?? 1) - 1;
                totalCount -= 1;
            }

            return {
                counts,
                totalCount,
                overallRating:       recomputeOverallRating(counts, totalCount),
                reviewsWithComments: current.reviewsWithComments.filter((review) => review.id !== reviewId),
                myReview:            current.myReview?.id === reviewId ? undefined : current.myReview,
            };
        });

        await this.#updateRecentReviews((recent) => recent.filter((review) => review.id !== reviewId));

        await this.#updateMyReviews((mine) => mine.filter((review) => review.id !== reviewId));
    }
}

export const REVIEW_STORE = new ReviewStore();
