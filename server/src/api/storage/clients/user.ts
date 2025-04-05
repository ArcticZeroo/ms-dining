import { Prisma, User } from '@prisma/client';
import { usePrismaClient } from '../client.js';
import { isUniqueConstraintFailedError } from '../../../util/prisma.js';

export abstract class UserStorageClient {
	static async createUserAsync(user: Prisma.UserCreateInput): Promise<User> {
		const newUser = await usePrismaClient(async prismaClient => {
			try {
				return await prismaClient.user.create({ data: user });
			} catch (err) {
				if (isUniqueConstraintFailedError(err)) {
					return prismaClient.user.findUnique({
						where: {
							externalId_provider: {
								externalId: user.externalId,
								provider:   user.provider
							}
						}
					});
				}

				throw err;
			}
		});

		if (!newUser) {
			throw new Error('User not created or found');
		}

		return newUser;
	}

	static async getUserAsync(uniqueValue: Prisma.UserFindUniqueArgs['where']): Promise<User | null> {
		return usePrismaClient(prismaClient => prismaClient.user.findUnique({
			where: uniqueValue
		}));
	}

	static async updateUserDisplayNameAsync(id: string, displayName: string): Promise<void> {
		await usePrismaClient(prismaClient => prismaClient.user.update({
			where: {
				id
			},
			data: {
				displayName
			},
			select: {
				id: true
			}
		}));
	}
}