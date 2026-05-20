import type { ISessionService } from '../../../shared/services/session.js';
import { dataHandler } from './handler.js';

export const sessionService: ISessionService = {
    get: (data) =>
        dataHandler.sendRequest('session', 'get', data),
    set: (data) =>
        dataHandler.sendRequest('session', 'set', data),
    destroy: (data) =>
        dataHandler.sendRequest('session', 'destroy', data),
};
