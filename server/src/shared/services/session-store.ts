export interface ISessionData {
    passport?: {
        user?: string;
    };
}

export interface ISessionStore {
    get(key: string): Promise<ISessionData | undefined>;
    set(key: string, sessionData: ISessionData, maxAge?: number): Promise<void>;
    destroy(key: string): Promise<void>;
}
