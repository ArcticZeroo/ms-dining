import { Prisma, User } from '@prisma/client';
import { usePrismaClient } from '../client.js';
import { isUniqueConstraintFailedError } from '../../../util/prisma.js';
import { IServerUser } from '../../../models/auth.js';
import { IUpdateUserSettingsInput } from '@msdining/common/dist/models/http.js';
import { Nullable } from '../../../models/util.js';
import { logDebug } from '../../../util/log.js';
import { sendVisitFireAndForget } from '../../tracking/visitors.js';
import { ANALYTICS_APPLICATION_NAMES } from '@msdining/common/dist/constants/analytics.js';
import { randomUUID } from 'node:crypto';

const ID_DELIMITER = ';';

interface IUpdateUserSettingsPrismaData {
	favoriteStations?: string | null;
	favoriteMenuItems?: string | null;
	homepageIds?: string | null;
	lastSettingsUpdate: Date | null;
}

export abstract class UserStorageClient {
	static async createUserAsync(userToCreate: Prisma.UserCreateInput): Promise<IServerUser> {
		const newUser = await usePrismaClient(async prismaClient => {
			try {
				const user = await prismaClient.user.create({ data: userToCreate });

				sendVisitFireAndForget(ANALYTICS_APPLICATION_NAMES.userSignup, randomUUID());

				return user;
			} catch (err) {
				if (isUniqueConstraintFailedError(err)) {
					return prismaClient.user.findUnique({
						where: {
							externalId_provider: {
								externalId: userToCreate.externalId,
								provider:   userToCreate.provider
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

	static async getUserAsync(uniqueValue: Prisma.UserFindUniqueArgs['where']): Promise<IServerUser | null> {
		const user = await usePrismaClient(prismaClient => prismaClient.user.findUnique({
			where: uniqueValue
		}));

		if (user == null) {
			return null;
		}

		const serverUser: IServerUser = {
			id:          user.id,
			externalId:  user.externalId,
			provider:    user.provider,
			displayName: user.displayName,
			role:        user.role,
			createdAt:   user.createdAt,
		};

		if (user.lastSettingsUpdate != null) {
			serverUser.settings = {
				favoriteStations:  UserStorageClient._deserializeSetting(user.favoriteStations),
				favoriteMenuItems: UserStorageClient._deserializeSetting(user.favoriteMenuItems),
				homepageIds:       UserStorageClient._deserializeSetting(user.homepageIds),
				lastUpdate:        user.lastSettingsUpdate
			};
		}

		return serverUser;
	}

	static async updateUserDisplayNameAsync(id: string, displayName: string): Promise<void> {
		await usePrismaClient(prismaClient => prismaClient.user.update({
			where:  {
				id
			},
			data:   {
				displayName
			},
			select: {
				id: true
			}
		}));
	}

	private static _deserializeSetting(settingValue: string | null): string[] {
		if (settingValue == null || settingValue.trim().length === 0) {
			return [];
		}

		const value = settingValue.split(ID_DELIMITER);
		if (value.length === 0) {
			return [];
		}

		return value;
	}

	private static _serializeSetting(settingValue: Nullable<string[]>): string | null {
		if (settingValue == null) {
			return null;
		}

		const value = settingValue.join(ID_DELIMITER);
		if (value.trim().length === 0) {
			return null;
		}

		return value;
	}

	static async updateUserSettingsAsync(id: string, {
		favoriteStations,
		favoriteMenuItems,
		homepageIds,
		timestamp
	}: IUpdateUserSettingsInput) {
		const data: IUpdateUserSettingsPrismaData = {
			lastSettingsUpdate: new Date(timestamp)
		};

		if (favoriteStations != null) {
			data.favoriteStations = UserStorageClient._serializeSetting(favoriteStations);
		}

		if (favoriteMenuItems != null) {
			data.favoriteMenuItems = UserStorageClient._serializeSetting(favoriteMenuItems);
		}

		if (homepageIds != null) {
			data.homepageIds = UserStorageClient._serializeSetting(homepageIds);
		}

		await usePrismaClient(async prismaClient => {
			const user = await prismaClient.user.findUnique({ where: { id }, select: { lastSettingsUpdate: true } });

			if (user == null) {
				throw new Error('User not found');
			}

			if (user.lastSettingsUpdate != null && user.lastSettingsUpdate.getTime() >= timestamp) {
				logDebug('Skipping settings update because server settings are newer');
				return;
			}

			await prismaClient.user.update({
				where: { id },
				data
			});

			logDebug('Updated user settings!');
		});
	}
}