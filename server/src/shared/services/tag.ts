import type { IMenuItemTag } from '../models/cafe.js';
import { EmptyObject } from '../models/util.js';

export interface ITagService {
    /** Retrieve all known menu-item tags, keyed by tag id → display name. */
    retrieveTags(data: EmptyObject): Promise<Record<string, string>>;

    /** Persist new tags; silently ignores duplicates. */
    createTags(data: { tags: IMenuItemTag[] }): Promise<void>;
}
