import type { ISessionData } from './session-store.js';

export interface ISessionService {
    /** Get session data by session id. Returns undefined if not found or expired. */
    get(data: { sessionId: string }): Promise<ISessionData | undefined>;

    /** Set (upsert) session data. */
    set(data: { sessionId: string; sessionData: ISessionData; maxAge?: number }): Promise<void>;

    /** Delete a session. */
    destroy(data: { sessionId: string }): Promise<void>;
}
