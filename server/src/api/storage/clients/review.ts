import { usePrismaClient } from '../client.js';
import { IUpdateReviewRequest } from '@msdining/common/dist/models/http.js';
import { toDateString } from '@msdining/common/dist/util/date-util.js';
import { Prisma } from '@prisma/client';

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

export abstract class ReviewStorageClient {
	public static async createReviewAsync(review: ICreateReviewItem) {
		const nowDateString = toDateString(new Date());

		return usePrismaClient(client => client.review.upsert({
			create: {
				menuItemId:  review.menuItemId,
				userId:      review.userId,
				rating:      review.rating,
				comment:     review.comment,
				createdDate: nowDateString
			},
			update: {
				rating:      review.rating,
				comment:     review.comment,
				createdDate: nowDateString
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
			include: {
				user: {
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
			}
		}));
	}

	public static async getReviewsForUserAsync({ userId, menuItemId }: IGetReviewsForUserParams) {
		return usePrismaClient(client => client.review.findMany({
			where:   {
				userId,
				menuItemId
			},
			include: {
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
			}
		}));
	}

	public static async updateReviewAsync(reviewId: string, update: IUpdateReviewRequest) {
		return usePrismaClient(client => client.review.update({
			where: {
				id: reviewId
			},
			data:  {
				rating:      update.rating,
				comment:     update.comment,
				createdDate: toDateString(new Date())
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
}