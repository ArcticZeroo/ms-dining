import { IThumbnailExistenceData } from '../../shared/models/thumbnail.js';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { getServices } from '../../shared/services/registry.js';

const retrieveThumbnailData = async (menuItem: IMenuItemBase): Promise<IThumbnailExistenceData> => {
    if (!menuItem.imageUrl) {
        return { hasThumbnail: false };
    }

    return getServices().data.menuItem.retrieveThumbnailData({
        id:             menuItem.id,
        imageUrl:       menuItem.imageUrl,
        lastUpdateTime: menuItem.lastUpdateTime,
    });
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