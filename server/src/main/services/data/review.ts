import type { IReviewService } from '../../../shared/services/review.js';
import { dataHandler } from './handler.js';

export const reviewService: IReviewService = {
    createMenuItemReview: (data) =>
        dataHandler.sendRequest('review', 'createMenuItemReview', data),
    createStationReview: (data) =>
        dataHandler.sendRequest('review', 'createStationReview', data),
    getReviewsForMenuItem: (data) =>
        dataHandler.sendRequest('review', 'getReviewsForMenuItem', data),
    getReviewsForStation: (data) =>
        dataHandler.sendRequest('review', 'getReviewsForStation', data),
    getReviewsForUser: (data) =>
        dataHandler.sendRequest('review', 'getReviewsForUser', data),
    getReviewById: (data) =>
        dataHandler.sendRequest('review', 'getReviewById', data),
    getRecentReviews: (data) =>
        dataHandler.sendRequest('review', 'getRecentReviews', data),
    updateReview: (data) =>
        dataHandler.sendRequest('review', 'updateReview', data),
    deleteReview: (data) =>
        dataHandler.sendRequest('review', 'deleteReview', data),
    isOwnedByUser: (data) =>
        dataHandler.sendRequest('review', 'isOwnedByUser', data),
    getAllMenuItemReviewHeaders: (data) =>
        dataHandler.sendRequest('review', 'getAllMenuItemReviewHeaders', data),
    getAllMenuItemReviewHeadersByGroupId: (data) =>
        dataHandler.sendRequest('review', 'getAllMenuItemReviewHeadersByGroupId', data),
    getMenuItemReviewHeaderByName: (data) =>
        dataHandler.sendRequest('review', 'getMenuItemReviewHeaderByName', data),
    getReviewHeaderByGroupId: (data) =>
        dataHandler.sendRequest('review', 'getReviewHeaderByGroupId', data),
    getAllStationReviewHeaders: (data) =>
        dataHandler.sendRequest('review', 'getAllStationReviewHeaders', data),
    getAllStationReviewHeadersByGroupId: (data) =>
        dataHandler.sendRequest('review', 'getAllStationReviewHeadersByGroupId', data),
    getStationReviewHeaderByName: (data) =>
        dataHandler.sendRequest('review', 'getStationReviewHeaderByName', data),
    getStationReviewHeaderByGroupId: (data) =>
        dataHandler.sendRequest('review', 'getStationReviewHeaderByGroupId', data),
};
