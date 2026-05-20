import type { ITagService } from '../../../shared/services/tag.js';
import { dataHandler } from './handler.js';

export const tagService: ITagService = {
    retrieveTags: (data) =>
        dataHandler.sendRequest('tag', 'retrieveTags', data),
    createTags: (data) =>
        dataHandler.sendRequest('tag', 'createTags', data),
};
