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
    readonly #menuItemIdsByStationId = new Map<string, Set<string>>();
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
                // Clean up station mapping for evicted menu item resources
                for (const [, menuItemIds] of this.#menuItemIdsByStationId) {
                    menuItemIds.delete(entityId);
                }
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

    getReviews(lookup: IReviewLookup, stationId?: string) {
        if (stationId && lookup.menuItemId) {
            const menuItemIds = this.#menuItemIdsByStationId.get(stationId) ?? new Set();
            menuItemIds.add(lookup.menuItemId);
            this.#menuItemIdsByStationId.set(stationId, menuItemIds);
        }
        return this.#getOrCreateResource(lookup).get();
    }

    get recentReviews() {
        return this.#recentReviews.get();
    }

    get myReviews() {
        return this.#myReviews.get();
    }

    // Station reviews appear in menu item review resources (keyed by menuItemId).
    // Use the station→menuItem mapping to update only affected resources.
    async #updateMenuItemResourcesForStation(
        stationId: string,
        updater: (current: IReviewSummary) => IReviewSummary
    ) {
        const menuItemIds = this.#menuItemIdsByStationId.get(stationId);
        if (!menuItemIds) {
            return;
        }
        const updates: Promise<void>[] = [];
        for (const menuItemId of menuItemIds) {
            const resource = this.#reviewsByEntityId.get(menuItemId);
            if (resource) {
                updates.push(resource.updateExisting(updater));
            }
        }
        await Promise.all(updates);
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
                overallRating:       recomputeOverallRating(counts, totalCount),
                reviewsWithComments,
                myReview:            isStation ? current.myReview : (request.anonymous ? current.myReview : review),
                myStationReview:     isStation ? (request.anonymous ? current.myStationReview : review) : current.myStationReview,
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

        const updateReviewFields = (existing: IReview, counts?: Record<number, number>): IReview => {
            const updated = { ...existing };
            if (request.rating != null && request.rating !== existing.rating) {
                if (counts) {
                    counts[existing.rating] = (counts[existing.rating] ?? 1) - 1;
                    counts[request.rating] = (counts[request.rating] ?? 0) + 1;
                }
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

        const updateResource = (current: IReviewSummary): IReviewSummary => {
            const counts = { ...current.counts };
            let myReview = current.myReview;
            let myStationReview = current.myStationReview;

            const reviewsWithComments = current.reviewsWithComments.flatMap((review) => {
                if (review.id !== reviewId) {
                    return [review];
                }
                const updated = updateReviewFields(review, counts);
                if (!updated.comment) {
                    return [];
                }
                return [updated as IReviewWithComment];
            });

            if (myReview?.id === reviewId) {
                myReview = updateReviewFields(myReview);
            }
            if (myStationReview?.id === reviewId) {
                myStationReview = updateReviewFields(myStationReview);
            }

            return {
                counts,
                totalCount:    current.totalCount,
                overallRating: recomputeOverallRating(counts, current.totalCount),
                reviewsWithComments,
                myReview,
                myStationReview,
            };
        };

        const entityId = getReviewEntityId(lookup);
        const resource = this.#reviewsByEntityId.get(entityId);
        await resource?.updateExisting(updateResource);

        if (isStationReview(lookup)) {
            await this.#updateMenuItemResourcesForStation(entityId, updateResource);
        }

        const patchReview = (review: IReview): IReview => {
            return review.id === reviewId ? updateReviewFields(review) : review;
        };

        await this.#updateRecentReviews((recent) => recent.map(patchReview));

        await this.#updateMyReviews((mine) => mine.map(patchReview));
    }

    async deleteReview(reviewId: string, lookup: IReviewLookup): Promise<void> {
        await DiningClient.deleteReview(reviewId);

        const removeReview = (current: IReviewSummary): IReviewSummary => {
            const deletedReview = current.reviewsWithComments.find((review) => review.id === reviewId)
                ?? (current.myReview?.id === reviewId ? current.myReview : undefined)
                ?? (current.myStationReview?.id === reviewId ? current.myStationReview : undefined);

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
                myStationReview:     current.myStationReview?.id === reviewId ? undefined : current.myStationReview,
            };
        };

        // Update the directly-keyed resource (works for menu item reviews)
        const entityId = getReviewEntityId(lookup);
        const resource = this.#reviewsByEntityId.get(entityId);
        await resource?.updateExisting(removeReview);

        // Station reviews appear in menu item resources — update affected ones
        if (isStationReview(lookup)) {
            await this.#updateMenuItemResourcesForStation(entityId, removeReview);
        }

        await this.#updateRecentReviews((recent) => recent.filter((review) => review.id !== reviewId));

        await this.#updateMyReviews((mine) => mine.filter((review) => review.id !== reviewId));
    }
}

export const REVIEW_STORE = new ReviewStore();
