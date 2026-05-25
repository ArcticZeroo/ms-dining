import { IThumbnailExistenceData, IThumbnailWorkerRequest } from '../../shared/models/thumbnail.js';
import { THUMBNAIL_THREAD_HANDLER } from '../data/threads/thumbnail.js';
import { logError } from '../../shared/util/log.js';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { getServices } from '../../shared/services/registry.js';

const retrieveThumbnailData = async (menuItem: IMenuItemBase): Promise<IThumbnailExistenceData> => {
    try {
        if (!menuItem.imageUrl) {
            return {
                hasThumbnail: false
            };
        }

        const request: IThumbnailWorkerRequest = {
            id:             menuItem.id,
            imageUrl:       menuItem.imageUrl,
            lastUpdateTime: menuItem.lastUpdateTime
        };

        const result = await THUMBNAIL_THREAD_HANDLER.sendRequest('thumbnail', 'getThumbnailData', request);
        if (!result) {
            return {
                hasThumbnail: false
            };
        }

        // Persist the hash to the DB (main-thread side, not in the thumbnail worker)
        if (result.hash) {
            getServices().data.menuItem.updateThumbnailHash({
                menuItemId: menuItem.id,
                hash:       result.hash,
            }).catch(err => logError(`Failed to persist thumbnail hash for ${menuItem.id}`, err));
        }

        return {
            hasThumbnail:    true,
            thumbnailWidth:  result.width,
            thumbnailHeight: result.height,
            lastUpdateTime:  result.lastUpdateTime
        };
    } catch (err) {
        logError(`Failed to retrieve thumbnail data for menu item ${menuItem.id}`, err);

        return {
            hasThumbnail: false
        };
    }
}

// Call this before showing a menu item to the user
// We do it this way so that we don't have to load thumbnail data in order to just look at search results
export const ensureThumbnailDataHasBeenRetrievedAsync = async (menuItem: IMenuItemBase) => {
    if (menuItem.hasRetrievedThumbnailData) {
        return false;
    }

    const thumbnailData = await retrieveThumbnailData(menuItem);
    Object.assign(menuItem, thumbnailData);
    menuItem.hasRetrievedThumbnailData = true;
}