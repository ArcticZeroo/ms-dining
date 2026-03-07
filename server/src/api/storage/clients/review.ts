import { usePrismaClient } from '../client.js';
import { STORAGE_EVENTS } from '../events.js';
import { IMenuItemBase, IMenuItemReviewHeader } from '@msdining/common/models/cafe';
import { getEntityKey, getEntityKeyFromParts, ENTITY_KEY_GROUP_PREFIX, ENTITY_KEY_NAME_PREFIX } from '@msdining/common/util/entity-key';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { Prisma } from '@prisma/client';
import { getReviewHeadersByGroupId, getReviewHeadersByName, getStationReviewHeadersByGroupId, getStationReviewHeadersByName } from '@prisma/client/sql';
import { IServerReview } from '../../../models/review.js';

interface ICreateMenuItemReviewItem {
	menuItemId: string;
	userId?: string;
	displayName?: string;
	rating: number;
	comment?: string;
	groupId?: string | null;
	normalizedName: string;
}

interface ICreateStationReviewItem {
	stationId: string;
	userId?: string;
	displayName?: string;
	rating: number;
	comment?: string;
	groupId?: string | null;
	normalizedName: string;
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

const REVIEW_ENTITY_SELECT = {
	user: {
		select: {
			displayName: true
		}
	},
	menuItem: {
		select: {
			name:           true,
			normalizedName: true,
			groupId:        true,
			cafe:           {
				select: {
					id: true
				}
			}
		},
	},
	station: {
		select: {
			name:           true,
			normalizedName: true,
			groupId:        true,
			cafe:           {
				select: {
					id: true
				}
			}
		},
	}
};

export abstract class ReviewStorageClient {
	public static async createMenuItemReviewAsync(review: ICreateMenuItemReviewItem) {
		let result: { id: string };
		const userId = review.userId;

		if (userId) {
			result = await usePrismaClient(client => client.review.upsert({
				create: {
					menuItemId:  review.menuItemId,
					userId:      userId,
					displayName: review.displayName,
					rating:      review.rating,
					comment:     review.comment,
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
					menuItemId:  review.menuItemId,
					displayName: review.displayName,
					rating:      review.rating,
					comment:     review.comment,
				},
				select: {
					id: true
				}
			}));
		}

		STORAGE_EVENTS.emit('reviewDirty', {
			menuItemId:     review.menuItemId,
			userId:         review.userId ?? null,
			normalizedName: review.normalizedName,
			groupId:        review.groupId
		});

		return result;
	}

	public static async createStationReviewAsync(review: ICreateStationReviewItem) {
		let result: { id: string };
		const userId = review.userId;

		if (userId) {
			result = await usePrismaClient(client => client.review.upsert({
				create: {
					stationId:   review.stationId,
					userId:      userId,
					displayName: review.displayName,
					rating:      review.rating,
					comment:     review.comment,
				},
				update: {
					rating:      review.rating,
					comment:     review.comment,
					displayName: review.displayName,
					createdAt:   new Date()
				},
				where:  {
					userId_stationId: {
						userId,
						stationId: review.stationId
					}
				},
				select: {
					id: true
				}
			}));
		} else {
			result = await usePrismaClient(client => client.review.create({
				data: {
					stationId:   review.stationId,
					displayName: review.displayName,
					rating:      review.rating,
					comment:     review.comment,
				},
				select: {
					id: true
				}
			}));
		}

		STORAGE_EVENTS.emit('reviewDirty', {
			stationId:      review.stationId,
			userId:         review.userId ?? null,
			normalizedName: review.normalizedName,
			groupId:        review.groupId
		});

		return result;
	}

	public static async getReviewsForMenuItemAsync(menuItem: IMenuItemBase): Promise<IServerReview[]> {
		const whereCondition: Prisma.ReviewWhereInput = {};
		if (menuItem.groupId) {
			whereCondition.menuItem = { groupId: menuItem.groupId };
		} else {
			whereCondition.menuItem = { normalizedName: normalizeNameForSearch(menuItem.name), groupId: null };
		}

		return usePrismaClient(client => client.review.findMany({
			where:   whereCondition,
			include: REVIEW_ENTITY_SELECT,
			orderBy: {
				createdAt: 'desc'
			}
		}));
	}

	public static async getReviewsForStationAsync(station: { name: string; groupId?: string | null }): Promise<IServerReview[]> {
		const whereCondition: Prisma.ReviewWhereInput = {};
		if (station.groupId) {
			whereCondition.station = { groupId: station.groupId };
		} else {
			whereCondition.station = { normalizedName: normalizeNameForSearch(station.name), groupId: null };
		}

		return usePrismaClient(client => client.review.findMany({
			where:   whereCondition,
			include: REVIEW_ENTITY_SELECT,
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
			include: REVIEW_ENTITY_SELECT,
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
						normalizedName: true,
						groupId:        true
					}
				},
				station: {
					select: {
						normalizedName: true,
						groupId:        true
					}
				}
			}
		}));

		const entity = result.menuItem ?? result.station;
		STORAGE_EVENTS.emit('reviewDirty', {
			menuItemId:     result.menuItemId,
			stationId:      result.stationId,
			userId:         result.userId,
			normalizedName: entity?.normalizedName ?? '',
			groupId:        entity?.groupId
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
						normalizedName: true,
						groupId:        true
					}
				},
				station: {
					select: {
						normalizedName: true,
						groupId:        true
					}
				}
			}
		}));

		const entity = result.menuItem ?? result.station;
		STORAGE_EVENTS.emit('reviewDirty', {
			menuItemId:     result.menuItemId,
			stationId:      result.stationId,
			userId:         result.userId,
			normalizedName: entity?.normalizedName ?? '',
			groupId:        entity?.groupId
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
			include: REVIEW_ENTITY_SELECT
		}));
	}

	public static async getRecentReviews(count: number): Promise<IServerReview[]> {
		return usePrismaClient(client => client.review.findMany({
			orderBy:  {
				createdAt: 'desc'
			},
			include:  REVIEW_ENTITY_SELECT,
			take:     count
		}));
	}

	// Returns review headers for non-grouped menu items, keyed by normalized name
	public static async getAllMenuItemReviewHeaders(): Promise<Array<IMenuItemReviewHeaderWithEntityKey>> {
		const results = await usePrismaClient(client => client.$queryRawTyped(getReviewHeadersByName()));

		return results.map(result => ({
			entityKey:        ENTITY_KEY_NAME_PREFIX + result.normalizedName,
			totalReviewCount: Number(result.reviewCount),
			overallRating:    result.averageRating ?? 0,
		}));
	}

	// Returns review headers for grouped menu items, keyed by groupId
	public static async getAllMenuItemReviewHeadersByGroupId(): Promise<Array<IMenuItemReviewHeaderWithEntityKey>> {
		const results = await usePrismaClient(client => client.$queryRawTyped(getReviewHeadersByGroupId()));

		return results.map(result => ({
			entityKey:        ENTITY_KEY_GROUP_PREFIX + result.groupId,
			totalReviewCount: Number(result.reviewCount),
			overallRating:    result.averageRating ?? 0,
		}));
	}

	// Cache miss: fetch header for a single non-grouped menu item by normalized name
	public static async getMenuItemReviewHeaderByName(normalizedName: string): Promise<IMenuItemReviewHeader> {
		const result = await usePrismaClient(client => client.review.aggregate({
			where:  {
				menuItem: { normalizedName, groupId: null }
			},
			_count: true,
			_avg:   {
				rating: true
			},
		}));

		return {
			totalReviewCount: result._count ?? 0,
			overallRating:    result._avg?.rating ?? 0,
		};
	}

	// Cache miss: fetch header for a single groupId (menu items)
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
			totalReviewCount: result._count ?? 0,
			overallRating:    result._avg?.rating ?? 0,
		};
	}

	// --- Station review headers ---

	// Returns station review headers for non-grouped stations, keyed by normalized name
	public static async getAllStationReviewHeaders(): Promise<Array<IMenuItemReviewHeaderWithEntityKey>> {
		const results = await usePrismaClient(client => client.$queryRawTyped(getStationReviewHeadersByName()));

		return results.map(result => ({
			entityKey:        ENTITY_KEY_NAME_PREFIX + result.normalizedName,
			totalReviewCount: Number(result.reviewCount),
			overallRating:    Number(result.averageRating ?? 0),
		}));
	}

	// Returns station review headers for grouped stations, keyed by groupId
	public static async getAllStationReviewHeadersByGroupId(): Promise<Array<IMenuItemReviewHeaderWithEntityKey>> {
		const results = await usePrismaClient(client => client.$queryRawTyped(getStationReviewHeadersByGroupId()));

		return results.map(result => ({
			entityKey:        ENTITY_KEY_GROUP_PREFIX + result.groupId,
			totalReviewCount: Number(result.reviewCount),
			overallRating:    Number(result.averageRating ?? 0),
		}));
	}

	// Cache miss: fetch station review header for a single non-grouped station by normalized name
	public static async getStationReviewHeaderByName(normalizedName: string): Promise<IMenuItemReviewHeader> {
		const result = await usePrismaClient(client => client.review.aggregate({
			where:  {
				station: { normalizedName, groupId: null }
			},
			_count: true,
			_avg:   {
				rating: true
			},
		}));

		return {
			totalReviewCount: result._count ?? 0,
			overallRating:    result._avg?.rating ?? 0,
		};
	}

	// Cache miss: fetch station review header for a single groupId
	public static async getStationReviewHeaderByGroupId(groupId: string): Promise<IMenuItemReviewHeader> {
		const result = await usePrismaClient(client => client.review.aggregate({
			where:  {
				station: { groupId }
			},
			_count: true,
			_avg:   {
				rating: true
			},
		}));

		return {
			totalReviewCount: result._count ?? 0,
			overallRating:    result._avg?.rating ?? 0,
		};
	}
}