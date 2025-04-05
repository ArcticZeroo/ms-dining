import { usePrismaClient } from '../client.js';
import { IUpdateReviewRequest } from '@msdining/common/dist/models/http.js';

interface ICreateReviewItem {
	menuItemId: string;
	cafeId: string;
	userId: string;
	rating: number;
	comment?: string;
}

export abstract class ReviewStorageClient {
	public static async createReviewAsync(review: ICreateReviewItem) {
		return usePrismaClient(client => client.review.create({
			data: {
				menuItemId: review.menuItemId,
				cafeId:     review.cafeId,
				userId:     review.userId,
				rating:     review.rating,
				comment:    review.comment
			}
		}));
	}

	public static async getReviewsForMenuItemAsync(menuItemId: string, cafeId?: string) {
		return usePrismaClient(client => client.review.findMany({
			where: {
				menuItemId,
				cafeId
			}
		}));
	}

	public static async getReviewsForUserAsync(userId: string) {
		return usePrismaClient(client => client.review.findMany({
			where: {
				userId
			}
		}));
	}

	public static async updateReviewAsync(reviewId: string, update: IUpdateReviewRequest) {
		return usePrismaClient(client => client.review.update({
			where: {
				id: reviewId
			},
			data: {
				rating:  update.rating,
				comment: update.comment
			}
		}));
	}
}