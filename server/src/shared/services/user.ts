import type { IServerUser } from '../models/auth.js';
import type { IUpdateUserSettingsInput } from '@msdining/common/models/http';

export interface ICreateUserInput {
    displayName: string;
    externalId: string;
    provider: string;
}

export interface IUserService {
    /** Create a user (or return existing if duplicate externalId+provider). */
    createUser(data: { user: ICreateUserInput }): Promise<IServerUser>;

    /** Get a user by internal id. Returns null if not found. */
    getUser(data: { id: string }): Promise<IServerUser | null>;

    /** Update a user's display name. */
    updateUserDisplayName(data: { id: string; displayName: string }): Promise<void>;

    /** Update user settings (favorites, homepage, etc). */
    updateUserSettings(data: { id: string; settings: IUpdateUserSettingsInput }): Promise<void>;
}
