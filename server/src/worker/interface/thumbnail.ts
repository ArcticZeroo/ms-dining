import { IThumbnailExistenceData, IThumbnailWorkerRequest } from '../../models/thumbnail.js';
import { THUMBNAIL_THREAD_HANDLER } from '../../api/worker-thread/thumbnail.js';
import { logError } from '../../util/log.js';
import { IMenuItem } from '@msdining/common/dist/models/cafe.js';

const retrieveThumbnailData = async (menuItem: IMenuItem): Promise<IThumbnailExistenceData> => {
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

		const result = await THUMBNAIL_THREAD_HANDLER.sendRequest('getThumbnailData', request);
		if (!result) {
			return {
				hasThumbnail: false
			};
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
export const ensureThumbnailDataHasBeenRetrievedAsync = async (menuItem: IMenuItem) => {
	if (menuItem.hasRetrievedThumbnailData) {
		return false;
	}

	const thumbnailData = await retrieveThumbnailData(menuItem);
	Object.assign(menuItem, thumbnailData);
	menuItem.hasRetrievedThumbnailData = true;
}