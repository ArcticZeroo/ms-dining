import { usePrismaClient } from '../client.js';
import { STORAGE_EVENTS } from '../events.js';
import { IMenuItemBase, IMenuItemReviewHeader } from '@msdining/common/models/cafe';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';

interface ICreateReviewItem {
	menuItemId: string;
	menuItemNormalizedName: string;
	userId: string;
	rating: number;
	comment?: string;
}

interface IGetReviewsForUserParams {
	userId: string;
	menuItemId?: string;
}

interface IMenuItemReviewHeaderWithName {
	menuItemNormalizedName: string;
	totalReviewCount: number;
	overallRating: number;
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
		const result = await usePrismaClient(client => client.review.upsert({
			create: {
				menuItemId:             review.menuItemId,
				menuItemNormalizedName: review.menuItemNormalizedName,
				userId:                 review.userId,
				rating:                 review.rating,
				comment:                review.comment,
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

		STORAGE_EVENTS.emit('reviewDirty', {
			menuItemId:             review.menuItemId,
			menuItemNormalizedName: review.menuItemNormalizedName,
			userId:                 review.userId
		});

		return result;
	}

	public static async getReviewsForMenuItemAsync(normalizedName: string) {
		return usePrismaClient(client => client.review.findMany({
			where:   {
				menuItem: {
					normalizedName
				}
			},
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
		const result = await usePrismaClient(client => client.review.delete({
			where: {
				id: reviewId
			},
		}));

		STORAGE_EVENTS.emit('reviewDirty', {
			menuItemId:             result.menuItemId,
			menuItemNormalizedName: result.menuItemNormalizedName,
			userId:                 result.userId
		});

		return result;
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
			orderBy:  {
				createdAt: 'desc'
			},
			distinct: ['menuItemId'],
			include:  GET_REVIEW_INCLUDES,
			take:     count
		}));
	}

	public static async getAllReviewHeaders(): Promise<Array<IMenuItemReviewHeaderWithName>> {
		const results = await usePrismaClient(client => client.review.groupBy({
			by:     ['menuItemNormalizedName'],
			_count: true,
			_avg:   {
				rating: true
			}
		}));

		return results.map(result => ({
			menuItemNormalizedName: result.menuItemNormalizedName,
			totalReviewCount:       result._count,
			overallRating:          result._avg.rating ?? 0,
		}));
	}

	public static async getReviewHeader(normalizedName: string): Promise<IMenuItemReviewHeader> {
		const result = await usePrismaClient(client => client.review.aggregate({
			where:  {
				menuItemNormalizedName: normalizedName
			},
			_count: true,
			_avg:   {
				rating: true
			},
		}));

		return {
			totalReviewCount: result._count,
			overallRating:    result._avg.rating ?? 0,
		};
	}
}