import { ICreateReviewRequest, IUpdateReviewRequest } from '@msdining/common/models/http';
import { IReview, IReviewSummary, IReviewWithComment } from '@msdining/common/models/review';
import { toDateString } from '@msdining/common/util/date-util';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DiningClient } from '../../api/client/dining.ts';
import { getReviewEntityId, getReviewEntityName, IReviewLookup, isStationReview } from '../../models/reviews.ts';
import { queryKeys } from './keys.ts';

const RECENT_REVIEWS_COUNT = 10;

// ---------- Pure projection / patch helpers (exported for testing) ----------

export const recomputeOverallRating = (
    counts: Record<number, number>,
    totalCount: number,
): number => {
    if (totalCount === 0) {
        return 0;
    }
    let sum = 0;
    for (const [rating, count] of Object.entries(counts)) {
        sum += Number(rating) * count;
    }
    return sum / totalCount;
};

interface IBuildReviewArgs {
    reviewId: string;
    lookup: IReviewLookup;
    request: ICreateReviewRequest;
    context: ICreateReviewContext;
}

export const buildReview = ({ reviewId, lookup, request, context }: IBuildReviewArgs): IReview => {
    const entityId = getReviewEntityId(lookup);
    const isStation = isStationReview(lookup);
    return {
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
};

export const patchSummaryAddReview = (
    current: IReviewSummary,
    review: IReview,
    isStation: boolean,
    isAnonymous: boolean,
): IReviewSummary => {
    const counts = { ...current.counts };
    counts[review.rating] = (counts[review.rating] ?? 0) + 1;
    const totalCount = current.totalCount + 1;

    const reviewsWithComments = review.comment
        ? [review as IReviewWithComment, ...current.reviewsWithComments]
        : [...current.reviewsWithComments];

    return {
        counts,
        totalCount,
        overallRating:   recomputeOverallRating(counts, totalCount),
        reviewsWithComments,
        myReview:        isStation
            ? current.myReview
            : (isAnonymous ? current.myReview : review),
        myStationReview: isStation
            ? (isAnonymous ? current.myStationReview : review)
            : current.myStationReview,
    };
};

export const patchReviewFields = (
    existing: IReview,
    request: IUpdateReviewRequest,
    counts?: Record<number, number>,
): IReview => {
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

export const patchSummaryUpdateReview = (
    current: IReviewSummary,
    reviewId: string,
    request: IUpdateReviewRequest,
): IReviewSummary => {
    const counts = { ...current.counts };
    let myReview = current.myReview;
    let myStationReview = current.myStationReview;

    const reviewsWithComments = current.reviewsWithComments.flatMap((review) => {
        if (review.id !== reviewId) {
            return [review];
        }
        const updated = patchReviewFields(review, request, counts);
        if (!updated.comment) {
            return [];
        }
        return [updated as IReviewWithComment];
    });

    if (myReview?.id === reviewId) {
        myReview = patchReviewFields(myReview, request);
    }
    if (myStationReview?.id === reviewId) {
        myStationReview = patchReviewFields(myStationReview, request);
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

export const patchSummaryRemoveReview = (
    current: IReviewSummary,
    reviewId: string,
): IReviewSummary => {
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

// ---------- Context for mutation hooks ----------

export interface ICreateReviewContext {
    userId?: string;
    userDisplayName: string;
    cafeId: string;
}

// ---------- Queries ----------

export const useReviewSummary = (lookup: IReviewLookup) => {
    const entityId = getReviewEntityId(lookup);
    return useQuery({
        queryKey: queryKeys.reviews.entityById(entityId),
        queryFn:  () => DiningClient.retrieveReviews(lookup),
    });
};

export const useRecentReviews = () =>
    useQuery({
        queryKey: queryKeys.reviews.recent,
        queryFn:  () => DiningClient.getRecentReviews(),
    });

export const useMyReviews = () =>
    useQuery({
        queryKey: queryKeys.reviews.mine,
        queryFn:  () => DiningClient.retrieveMyReviews(),
    });

// ---------- Mutations ----------

type QueryClientInstance = ReturnType<typeof useQueryClient>;

const patchQueryData = async <T>(
    queryClient: QueryClientInstance,
    queryKey: readonly unknown[],
    updater: (current: T) => T,
): Promise<void> => {
    await queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData<T>(
        queryKey,
        (current) => (current ? updater(current) : current),
    );
};

const patchSummary = (queryClient: QueryClientInstance, entityId: string, updater: (current: IReviewSummary) => IReviewSummary) =>
    patchQueryData<IReviewSummary>(queryClient, queryKeys.reviews.entityById(entityId), updater);

const patchRecent = (queryClient: QueryClientInstance, updater: (reviews: IReview[]) => IReview[]) =>
    patchQueryData<IReview[]>(queryClient, queryKeys.reviews.recent, updater);

const patchMine = (queryClient: QueryClientInstance, updater: (reviews: IReview[]) => IReview[]) =>
    patchQueryData<IReview[]>(queryClient, queryKeys.reviews.mine, updater);

/**
 * Walks every cached summary and applies `updater` to those whose myStationReview
 * matches `stationEntityId`. Replaces the old `#menuItemIdsByStationId` mapping —
 * we just ask the cache directly instead of maintaining a parallel index.
 */
const patchSummariesContainingStation = async (
    queryClient: QueryClientInstance,
    stationEntityId: string,
    updater: (current: IReviewSummary) => IReviewSummary,
): Promise<void> => {
    const entries = queryClient.getQueryCache().findAll({ queryKey: queryKeys.reviews.summary });
    const tasks: Promise<void>[] = [];
    for (const entry of entries) {
        const summary = entry.state.data as IReviewSummary | undefined;
        if (!summary?.myStationReview || summary.myStationReview.stationId !== stationEntityId) {
            continue;
        }
        tasks.push(patchQueryData<IReviewSummary>(queryClient, entry.queryKey, updater));
    }
    await Promise.all(tasks);
};

interface ICreateReviewArgs {
    lookup: IReviewLookup;
    request: ICreateReviewRequest;
    context: ICreateReviewContext;
}

export const useCreateReview = () => {
    const queryClient = useQueryClient();
    return useMutation<string /*reviewId*/, Error, ICreateReviewArgs>({
        mutationFn: ({ lookup, request }) => DiningClient.createReview(lookup, request),
        onSuccess:  async (reviewId, { lookup, request, context }) => {
            const review = buildReview({ reviewId, lookup, request, context });
            const entityId = getReviewEntityId(lookup);
            const isStation = isStationReview(lookup);
            const isAnonymous = request.anonymous === true;

            await patchSummary(queryClient, entityId, (current) =>
                patchSummaryAddReview(current, review, isStation, isAnonymous),
            );

            await patchRecent(queryClient, (recent) => {
                const filtered = recent.filter((existing) => (existing.menuItemId ?? existing.stationId) !== entityId);
                return [review, ...filtered].slice(0, RECENT_REVIEWS_COUNT);
            });

            if (!isAnonymous) {
                await patchMine(queryClient, (mine) => {
                    const filtered = mine.filter((existing) => (existing.menuItemId ?? existing.stationId) !== entityId);
                    return [review, ...filtered];
                });
            }
        },
    });
};

interface IUpdateReviewArgs {
    reviewId: string;
    lookup: IReviewLookup;
    request: IUpdateReviewRequest;
}

export const useUpdateReview = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, IUpdateReviewArgs>({
        mutationFn: ({ reviewId, request }) => DiningClient.updateReview(reviewId, request),
        onSuccess:  async (_void, { reviewId, lookup, request }) => {
            const entityId = getReviewEntityId(lookup);
            const updater = (current: IReviewSummary) => patchSummaryUpdateReview(current, reviewId, request);

            await patchSummary(queryClient, entityId, updater);

            if (isStationReview(lookup)) {
                await patchSummariesContainingStation(queryClient, entityId, updater);
            }

            const patchReview = (review: IReview): IReview =>
                review.id === reviewId ? patchReviewFields(review, request) : review;

            await patchRecent(queryClient, (recent) => recent.map(patchReview));
            await patchMine(queryClient, (mine) => mine.map(patchReview));
        },
    });
};

interface IDeleteReviewArgs {
    reviewId: string;
    lookup: IReviewLookup;
}

export const useDeleteReview = () => {
    const queryClient = useQueryClient();
    return useMutation<void, Error, IDeleteReviewArgs>({
        mutationFn: ({ reviewId }) => DiningClient.deleteReview(reviewId),
        onSuccess:  async (_void, { reviewId, lookup }) => {
            const entityId = getReviewEntityId(lookup);
            const updater = (current: IReviewSummary) => patchSummaryRemoveReview(current, reviewId);

            await patchSummary(queryClient, entityId, updater);

            if (isStationReview(lookup)) {
                await patchSummariesContainingStation(queryClient, entityId, updater);
            }

            await patchRecent(queryClient, (recent) => recent.filter((review) => review.id !== reviewId));
            await patchMine(queryClient, (mine) => mine.filter((review) => review.id !== reviewId));
        },
    });
};
