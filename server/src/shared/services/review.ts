import type { IMenuItemBase, IMenuItemReviewHeader } from '@msdining/common/models/cafe';
import type { IServerReview } from '../models/review.js';

export interface ICreateMenuItemReviewInput {
    menuItemId: string;
    userId?: string;
    displayName?: string;
    rating: number;
    comment?: string;
    groupId?: string | null;
    normalizedName: string;
}

export interface ICreateStationReviewInput {
    stationId: string;
    userId?: string;
    displayName?: string;
    rating: number;
    comment?: string;
    groupId?: string | null;
    normalizedName: string;
}

export interface IUpdateReviewInput {
    rating?: number;
    comment?: string;
    displayName?: string;
}

export interface IMenuItemReviewHeaderWithEntityKey {
    entityKey: string;
    totalReviewCount: number;
    overallRating: number;
}

export interface IMenuItemReviewsResult {
    menuItemReviews: IServerReview[];
    stationReviews: IServerReview[];
}

export interface IReviewService {
    createMenuItemReview(data: { review: ICreateMenuItemReviewInput }): Promise<{ id: string }>;
    createStationReview(data: { review: ICreateStationReviewInput }): Promise<{ id: string }>;

    getReviewsForMenuItem(data: { menuItem: IMenuItemBase }): Promise<IMenuItemReviewsResult>;
    getReviewsForStation(data: { station: { name: string; groupId?: string | null } }): Promise<IServerReview[]>;
    getReviewsForUser(data: { userId: string; menuItemId?: string }): Promise<IServerReview[]>;

    getReviewById(data: { reviewId: string }): Promise<IServerReview | null>;
    getRecentReviews(data: { count: number }): Promise<IServerReview[]>;

    updateReview(data: { reviewId: string; update: IUpdateReviewInput }): Promise<void>;
    deleteReview(data: { reviewId: string }): Promise<void>;
    isOwnedByUser(data: { reviewId: string; userId: string }): Promise<boolean>;

    // Review header methods (used by cache layer)
    getAllMenuItemReviewHeaders(data: {}): Promise<IMenuItemReviewHeaderWithEntityKey[]>;
    getAllMenuItemReviewHeadersByGroupId(data: {}): Promise<IMenuItemReviewHeaderWithEntityKey[]>;
    getMenuItemReviewHeaderByName(data: { normalizedName: string }): Promise<IMenuItemReviewHeader>;
    getReviewHeaderByGroupId(data: { groupId: string }): Promise<IMenuItemReviewHeader>;

    getAllStationReviewHeaders(data: {}): Promise<IMenuItemReviewHeaderWithEntityKey[]>;
    getAllStationReviewHeadersByGroupId(data: {}): Promise<IMenuItemReviewHeaderWithEntityKey[]>;
    getStationReviewHeaderByName(data: { normalizedName: string }): Promise<IMenuItemReviewHeader>;
    getStationReviewHeaderByGroupId(data: { groupId: string }): Promise<IMenuItemReviewHeader>;
}
