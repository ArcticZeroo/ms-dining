import type { ICafe, ICafeConfig } from '../models/cafe.js';

/** Wire-safe representation of a persisted café record (mirrors Prisma's `Cafe` model). */
export interface ICafeRecord {
    id: string;
    name: string;
    tenantId: string;
    logoName: string | null;
    contextId: string;
    displayProfileId: string;
    storeId: string;
    externalName: string;
}

export interface ICafeService {
    /** Get a single café by id. Returns null if not found. */
    retrieveCafe(data: { id: string }): Promise<ICafeRecord | null>;

    /** Get all cafés, keyed by id. */
    retrieveCafes(data: {}): Promise<Record<string, ICafeRecord>>;

    /** Check whether a café with the given id exists. */
    doesCafeExist(data: { id: string }): Promise<boolean>;

    /** Create or update a café with its config. */
    createCafe(data: { cafe: ICafe; config: ICafeConfig }): Promise<void>;

    /** Clear the in-memory café cache, forcing a re-fetch from the DB on next access. */
    resetCache(data: {}): Promise<void>;
}
