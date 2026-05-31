import type { ISessionData, ISessionStore } from '../../shared/services/session-store.js';
import { getServices } from '../../shared/services/registry.js';

/**
 * Koa-session store adapter that delegates to the data service.
 * Translates koa-session's positional args to the data-object arg shape.
 */
export class SessionStoreAdapter implements ISessionStore {
    async get(sessionId: string) {
        return getServices().data.session.get({ sessionId });
    }

    async set(sessionId: string, sessionData: ISessionData, maxAge?: number) {
        return getServices().data.session.set({ sessionId, sessionData, maxAge });
    }

    async destroy(sessionId: string) {
        return getServices().data.session.destroy({ sessionId });
    }
}