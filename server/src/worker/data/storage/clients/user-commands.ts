import type { IUpdateUserSettingsInput } from '@msdining/common/models/http';
import type { ICreateUserInput, IUserService } from '../../../../shared/services/user.js';
import { UserStorageClient } from './user.js';

export const userServiceCommands = {
    createUser: async ({ user }: { user: ICreateUserInput }) =>
        UserStorageClient.createUserAsync(user),
    getUser: async ({ id }: { id: string }) =>
        UserStorageClient.getUserAsync({ id }),
    updateUserDisplayName: async ({ id, displayName }: { id: string; displayName: string }) =>
        UserStorageClient.updateUserDisplayNameAsync(id, displayName),
    updateUserSettings: async ({ id, settings }: { id: string; settings: IUpdateUserSettingsInput }) =>
        UserStorageClient.updateUserSettingsAsync(id, settings),
} satisfies IUserService;
