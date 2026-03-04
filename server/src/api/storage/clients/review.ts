import { usePrismaClient } from '../client.js';
import { STORAGE_EVENTS } from '../events.js';
import { IMenuItemBase, IMenuItemReviewHeader } from '@msdining/common/models/cafe';
import { getEntityKey, getEntityKeyFromParts, ENTITY_KEY_GROUP_PREFIX, ENTITY_KEY_NAME_PREFIX } from '@msdining/common/util/entity-key';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { Prisma } from '@prisma/client';
import { getReviewHeadersByGroupId } from '@prisma/client/sql';
import { IServerReview } from '../../../models/review.js';

interface ICreateReviewItem {
	menuItemId: string;
	menuItemNormalizedName: string;
	userId?: string;
	displayName?: string;
	rating: number;
	comment?: string;
	groupId?: string | null;
}

interface IUpdateReviewItem {
	rating?: number;
	comment?: string;
	displayName?: string;
}

interface IGetReviewsForUserParams {
	userId: string;
	menuItemId?: string;
}

interface IMenuItemReviewHeaderWithEntityKey {
	entityKey: string;
	totalReviewCount: number;
	overallRating: number;
}

export const getReviewEntityKey = (menuItem: IMenuItemBase): string => getEntityKey(menuItem);

export const getReviewEntityKeyFromParts = getEntityKeyFromParts;

const GET_REVIEW_INCLUDES = {
	user:     {
		select: {
			displayName: true
		}
	},
	menuItem: {
		select: {
			name:    true,
			groupId: true,
			cafe:    {
				select: {
					id: true
				}
			}
		},
	}
};

export abstract class ReviewStorageClient {
	public static async createReviewAsync(review: ICreateReviewItem) {
		let result: { id: string };
		const userId = review.userId;

		if (userId) {
			result = await usePrismaClient(client => client.review.upsert({
				create: {
					menuItemId:             review.menuItemId,
					menuItemNormalizedName: review.menuItemNormalizedName,
					userId:                 userId,
					displayName:            review.displayName,
					rating:                 review.rating,
					comment:                review.comment,
				},
				update: {
					rating:      review.rating,
					comment:     review.comment,
					displayName: review.displayName,
					createdAt:   new Date()
				},
				where:  {
					userId_menuItemId: {
						userId,
						menuItemId: review.menuItemId
					}
				},
				select: {
					id: true
				}
			}));
		} else {
			result = await usePrismaClient(client => client.review.create({
				data: {
					menuItemId:             review.menuItemId,
					menuItemNormalizedName: review.menuItemNormalizedName,
					displayName:            review.displayName,
					rating:                 review.rating,
					comment:                review.comment,
				},
				select: {
					id: true
				}
			}));
		}

		STORAGE_EVENTS.emit('reviewDirty', {
			menuItemId:             review.menuItemId,
			menuItemNormalizedName: review.menuItemNormalizedName,
			userId:                 review.userId ?? null,
			groupId:                review.groupId
		});

		return result;
	}

	public static async getReviewsForMenuItemAsync(menuItem: IMenuItemBase): Promise<IServerReview[]> {
		const whereCondition: Prisma.ReviewWhereInput = {};
		if (menuItem.groupId) {
			whereCondition.menuItem = { groupId: menuItem.groupId };
		} else {
			whereCondition.menuItemNormalizedName = normalizeNameForSearch(menuItem.name);
			whereCondition.menuItem = { groupId: null };
		}

		return usePrismaClient(client => client.review.findMany({
			where:   whereCondition,
			include: GET_REVIEW_INCLUDES,
			orderBy: {
				createdAt: 'desc'
			}
		}));
	}

	public static async getReviewsForUserAsync({ userId, menuItemId }: IGetReviewsForUserParams): Promise<IServerReview[]> {
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

	public static async updateReviewAsync(reviewId: string, data: IUpdateReviewItem) {
		const result = await usePrismaClient(client => client.review.update({
			where: {
				id: reviewId
			},
			data: {
				...(data.rating != null && { rating: data.rating }),
				...(data.comment != null && { comment: data.comment }),
				...(data.displayName != null && { displayName: data.displayName }),
			},
			include: {
				menuItem: {
					select: {
						groupId: true
					}
				}
			}
		}));

		STORAGE_EVENTS.emit('reviewDirty', {
			menuItemId:             result.menuItemId,
			menuItemNormalizedName: result.menuItemNormalizedName,
			userId:                 result.userId,
			groupId:                result.menuItem.groupId
		});

		return result;
	}

	public static async deleteReviewAsync(reviewId: string) {
		const result = await usePrismaClient(client => client.review.delete({
			where:   {
				id: reviewId
			},
			include: {
				menuItem: {
					select: {
						groupId: true
					}
				}
			}
		}));

		STORAGE_EVENTS.emit('reviewDirty', {
			menuItemId:             result.menuItemId,
			menuItemNormalizedName: result.menuItemNormalizedName,
			userId:                 result.userId,
			groupId:                result.menuItem.groupId
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

	public static async getReviewByIdAsync(reviewId: string): Promise<IServerReview | null> {
		return usePrismaClient(client => client.review.findUnique({
			where:   { id: reviewId },
			include: GET_REVIEW_INCLUDES
		}));
	}

	public static async getRecentReviews(count: number): Promise<IServerReview[]> {
		return usePrismaClient(client => client.review.findMany({
			orderBy:  {
				createdAt: 'desc'
			},
			distinct: ['menuItemId'],
			include:  GET_REVIEW_INCLUDES,
			take:     count
		}));
	}

	// Returns review headers for non-grouped items only, keyed by normalized name
	public static async getAllReviewHeaders(): Promise<Array<IMenuItemReviewHeaderWithEntityKey>> {
		const results = await usePrismaClient(client => client.review.groupBy({
			by:     ['menuItemNormalizedName'],
			where:  {
				menuItem: { groupId: null }
			},
			_count: true,
			_avg:   {
				rating: true
			}
		}));

		return results.map(result => ({
			entityKey:        ENTITY_KEY_NAME_PREFIX + result.menuItemNormalizedName,
			totalReviewCount: result._count,
			overallRating:    result._avg.rating ?? 0,
		}));
	}

	// Returns review headers for grouped items, keyed by groupId
	public static async getAllReviewHeadersByGroupId(): Promise<Array<IMenuItemReviewHeaderWithEntityKey>> {
		const results = await usePrismaClient(client => client.$queryRawTyped(getReviewHeadersByGroupId()));

		return results.map(result => ({
			entityKey:        ENTITY_KEY_GROUP_PREFIX + result.groupId,
			totalReviewCount: Number(result.reviewCount),
			overallRating:    result.averageRating ?? 0,
		}));
	}

	// Cache miss: fetch header for a single non-grouped normalized name
	public static async getReviewHeaderByName(normalizedName: string): Promise<IMenuItemReviewHeader> {
		const result = await usePrismaClient(client => client.review.aggregate({
			where:  {
				menuItemNormalizedName: normalizedName,
				menuItem:              { groupId: null }
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

	// Cache miss: fetch header for a single groupId
	public static async getReviewHeaderByGroupId(groupId: string): Promise<IMenuItemReviewHeader> {
		const result = await usePrismaClient(client => client.review.aggregate({
			where:  {
				menuItem: { groupId }
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