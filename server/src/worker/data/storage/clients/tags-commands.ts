import type { IMenuItemTag } from '../../../../shared/models/cafe.js';
import type { ITagService } from '../../../../shared/services/tag.js';
import { TagStorageClient } from './tags.js';

export const tagServiceCommands = {
    retrieveTags: async (_data: {}) => {
        const map = await TagStorageClient.retrieveTagsAsync();
        return Object.fromEntries(map);
    },
    createTags: async ({ tags }: { tags: IMenuItemTag[] }) =>
        TagStorageClient.createTags(tags),
} satisfies ITagService;
