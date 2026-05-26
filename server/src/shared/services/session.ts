export interface ISessionService {
    /** Get session data by session id. Returns null if not found or expired. */
    get(data: { sessionId: string }): Promise<unknown>;

    /** Set (upsert) session data. */
    set(data: { sessionId: string; sessionData: unknown; maxAge?: number }): Promise<void>;

    /** Delete a session. */
    destroy(data: { sessionId: string }): Promise<void>;
}
