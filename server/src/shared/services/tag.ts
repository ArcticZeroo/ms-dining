import type { IMenuItemTag } from '../models/cafe.js';

export interface ITagService {
    /** Retrieve all known menu-item tags, keyed by tag id → display name. */
    retrieveTags(data: {}): Promise<Record<string, string>>;

    /** Persist new tags; silently ignores duplicates. */
    createTags(data: { tags: IMenuItemTag[] }): Promise<void>;
}
