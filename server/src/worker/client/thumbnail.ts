import { IThumbnailExistenceData, IThumbnailWorkerRequest } from '../../models/thumbnail.js';
import { THUMBNAIL_THREAD_HANDLER } from '../../api/worker-thread/thumbnail.js';
import { Nullable } from '../../models/util.js';
import { logError } from '../../util/log.js';

interface IMenuItemForThumbnail {
	id: string;
	imageUrl?: Nullable<string>;
	lastUpdateTime?: Date;
}

export const retrieveThumbnailData = async (menuItem: IMenuItemForThumbnail): Promise<IThumbnailExistenceData> => {
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