import { IMenuItemBase } from '@msdining/common/models/cafe';
import type {
    ICreateMenuItemReviewInput,
    ICreateStationReviewInput,
    IReviewService,
    IUpdateReviewInput,
} from '../../../../../shared/services/review.js';
import { ReviewStorageClient } from './review.js';
import {
    retrieveReviewHeaderAsync,
    retrieveReviewHeaderByPartsAsync,
    retrieveStationReviewHeaderAsync,
    retrieveStationReviewHeaderByPartsAsync,
} from '../../../cache/reviews.js';

export const reviewServiceCommands = {
    createMenuItemReview: async ({ review }: { review: ICreateMenuItemReviewInput }) =>
        ReviewStorageClient.createMenuItemReviewAsync(review),
    createStationReview: async ({ review }: { review: ICreateStationReviewInput }) =>
        ReviewStorageClient.createStationReviewAsync(review),
    getReviewsForMenuItem: async ({ menuItem }: { menuItem: IMenuItemBase }) =>
        ReviewStorageClient.getReviewsForMenuItemAsync(menuItem),
    getReviewsForStation: async ({ station }: { station: { name: string; groupId?: string | null } }) =>
        ReviewStorageClient.getReviewsForStationAsync(station),
    getReviewsForUser: async ({ userId, menuItemId }: { userId: string; menuItemId?: string }) =>
        ReviewStorageClient.getReviewsForUserAsync({ userId, menuItemId }),
    retrieveReviewHeader: async ({ menuItem }: { menuItem: IMenuItemBase }) =>
        retrieveReviewHeaderAsync(menuItem),
    retrieveStationReviewHeader: async ({ station }: { station: { name: string; groupId?: string | null } }) =>
        retrieveStationReviewHeaderAsync(station),
    retrieveReviewHeaderByParts: async ({ groupId, name }: { groupId?: string | null; name: string }) =>
        retrieveReviewHeaderByPartsAsync(groupId, name),
    retrieveStationReviewHeaderByParts: async ({ groupId, name }: { groupId?: string | null; name: string }) =>
        retrieveStationReviewHeaderByPartsAsync(groupId, name),
    getReviewById: async ({ reviewId }: { reviewId: string }) =>
        ReviewStorageClient.getReviewByIdAsync(reviewId),
    getRecentReviews: async ({ count }: { count: number }) =>
        ReviewStorageClient.getRecentReviews(count),
    updateReview: async ({ reviewId, update }: { reviewId: string; update: IUpdateReviewInput }) => {
        await ReviewStorageClient.updateReviewAsync(reviewId, update);
    },
    deleteReview: async ({ reviewId }: { reviewId: string }) => {
        await ReviewStorageClient.deleteReviewAsync(reviewId);
    },
    isOwnedByUser: async ({ reviewId, userId }: { reviewId: string; userId: string }) =>
        ReviewStorageClient.isOwnedByUser(reviewId, userId),
    getAllMenuItemReviewHeaders: async () =>
        ReviewStorageClient.getAllMenuItemReviewHeaders(),
    getAllMenuItemReviewHeadersByGroupId: async () =>
        ReviewStorageClient.getAllMenuItemReviewHeadersByGroupId(),
    getMenuItemReviewHeaderByName: async ({ normalizedName }: { normalizedName: string }) =>
        ReviewStorageClient.getMenuItemReviewHeaderByName(normalizedName),
    getReviewHeaderByGroupId: async ({ groupId }: { groupId: string }) =>
        ReviewStorageClient.getReviewHeaderByGroupId(groupId),
    getAllStationReviewHeaders: async () =>
        ReviewStorageClient.getAllStationReviewHeaders(),
    getAllStationReviewHeadersByGroupId: async () =>
        ReviewStorageClient.getAllStationReviewHeadersByGroupId(),
    getStationReviewHeaderByName: async ({ normalizedName }: { normalizedName: string }) =>
        ReviewStorageClient.getStationReviewHeaderByName(normalizedName),
    getStationReviewHeaderByGroupId: async ({ groupId }: { groupId: string }) =>
        ReviewStorageClient.getStationReviewHeaderByGroupId(groupId),
} satisfies IReviewService;
