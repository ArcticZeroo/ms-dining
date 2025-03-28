import { IThumbnailExistenceData, IThumbnailWorkerRequest } from '../../models/thumbnail.js';
import { THUMBNAIL_THREAD_HANDLER } from '../../api/worker-thread/thumbnail.js';
import { logError } from '../../util/log.js';
import { MenuItem } from '@prisma/client';

export const retrieveThumbnailData = async (menuItem: MenuItem): Promise<IThumbnailExistenceData> => {
	try {
		if (!menuItem.imageUrl) {
			return {
				hasThumbnail: false
			};
		}

		const request: IThumbnailWorkerRequest = {
			id:             menuItem.id,
			imageUrl:       menuItem.imageUrl,
			lastUpdateTime: menuItem.externalLastUpdateTime
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