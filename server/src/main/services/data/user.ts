import type { IUserService } from '../../../shared/services/user.js';
import { dataHandler } from './handler.js';

export const userService: IUserService = {
    createUser: (data) =>
        dataHandler.sendRequest('user', 'createUser', data),
    getUser: (data) =>
        dataHandler.sendRequest('user', 'getUser', data),
    updateUserDisplayName: (data) =>
        dataHandler.sendRequest('user', 'updateUserDisplayName', data),
    updateUserSettings: (data) =>
        dataHandler.sendRequest('user', 'updateUserSettings', data),
};
