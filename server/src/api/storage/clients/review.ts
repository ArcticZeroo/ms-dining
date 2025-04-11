import { usePrismaClient } from '../client.js';

interface ICreateReviewItem {
	menuItemId: string;
	cafeId?: string;
	userId: string;
	rating: number;
	comment?: string;
}

interface IGetReviewsForUserParams {
	userId: string;
	menuItemId?: string;
}

const GET_REVIEW_INCLUDES = {
	user:     {
		select: {
			displayName: true
		}
	},
	menuItem: {
		select: {
			name: true,
			cafe: {
				select: {
					id: true
				}
			}
		},
	}
};

export abstract class ReviewStorageClient {
	public static async createReviewAsync(review: ICreateReviewItem) {
		return usePrismaClient(client => client.review.upsert({
			create: {
				menuItemId: review.menuItemId,
				userId:     review.userId,
				rating:     review.rating,
				comment:    review.comment,
			},
			update: {
				rating:    review.rating,
				comment:   review.comment,
				createdAt: new Date()
			},
			where:  {
				userId_menuItemId: {
					userId:     review.userId,
					menuItemId: review.menuItemId
				}
			},
			select: {
				id: true
			}
		}));
	}

	public static async getReviewsForMenuItemAsync(menuItemId: string) {
		return usePrismaClient(client => client.review.findMany({
			where:   { menuItemId },
			include: GET_REVIEW_INCLUDES,
			orderBy: {
				createdAt: 'desc'
			}
		}));
	}

	public static async getReviewsForUserAsync({ userId, menuItemId }: IGetReviewsForUserParams) {
		return usePrismaClient(client => client.review.findMany({
			where:   {
				userId,
				menuItemId
			},
			include: GET_REVIEW_INCLUDES,
			orderBy: {
				createdAt: 'desc'
			}
		}));
	}

	public static async deleteReviewAsync(reviewId: string) {
		return usePrismaClient(client => client.review.delete({
			where: {
				id: reviewId
			},
		}));
	}

	public static async isOwnedByUser(reviewId: string, userId: string) {
		const review = await usePrismaClient(prismaClient => prismaClient.review.findUnique({
			where:  {
				id: reviewId,
				userId
			},
			select: {
				userId: true
			}
		}));

		return review != null;
	}

	public static async getRecentReviews(count: number) {
		return usePrismaClient(client => client.review.findMany({
			orderBy: {
				createdAt: 'desc'
			},
			distinct: ['menuItemId'],
			include: GET_REVIEW_INCLUDES,
			take: count
		}));
	}
}