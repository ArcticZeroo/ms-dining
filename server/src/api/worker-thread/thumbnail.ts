import { WorkerThreadCommandHandler } from './commanding.js';
import { isMainThread } from 'node:worker_threads';
import * as fs from 'node:fs/promises';
import { serverMenuItemThumbnailPath } from '../../constants/config.js';
import { logDebug, logError, logInfo } from '../../util/log.js';
import { IImageMetadata, retrieveImageMetadataAsync } from '../../util/image.js';
import path from 'path';
import { IThumbnailWorkerRequest } from '../../models/thumbnail.js';
import { createAndSaveThumbnailForMenuItem } from '../cafe/image/thumbnail.js';
import { LockMap } from '../lock.js';

const thumbnailDataByMenuItemId = new Map<string, IImageMetadata>();
const THUMBNAIL_SEMAPHORE_BY_ID = new LockMap();

const loadExistingThumbnailsOnBoot = async () => {
	console.time('thumbnail loading on boot');

	const files = await fs.readdir(serverMenuItemThumbnailPath);

	for (const fileNode of files) {
		const [id, extension] = fileNode.split('.');

		if (!id || !extension) {
			logError(`[Thumbnail Thread] Invalid thumbnail file on disk: ${fileNode}`);
			continue;
		}

		if (extension !== 'png') {
			continue;
		}

		const metadata = await retrieveImageMetadataAsync(path.join(serverMenuItemThumbnailPath, fileNode));
		if (!metadata) {
			continue;
		}

		thumbnailDataByMenuItemId.set(id, metadata);
	}

	logInfo(`[Thumbnail Thread] Loaded ${thumbnailDataByMenuItemId.size} thumbnails on boot`);

	console.timeEnd('thumbnail loading on boot');
}

const getThumbnailData = async (request: IThumbnailWorkerRequest): Promise<IImageMetadata | null> => {
	await loadThumbnailsPromise;
	return THUMBNAIL_SEMAPHORE_BY_ID.acquire(request.id, async () => {
		if (thumbnailDataByMenuItemId.has(request.id)) {
			const metadata = thumbnailDataByMenuItemId.get(request.id)!;
			if (request.lastUpdateTime == null || metadata.lastUpdateTime.getTime() >= request.lastUpdateTime.getTime()) {
				if (request.lastUpdateTime == null) {
					logDebug(`[Thumbnail Thread] Returning existing thumbnail for menu item ${request.id} without update check due to no lastUpdateTime provided`);
				} else {
					logDebug(`[Thumbnail Thread] Returning existing thumbnail for menu item ${request.id} with request lastUpdateTime ${request.lastUpdateTime.toISOString()} and metadata lastUpdateTime ${metadata.lastUpdateTime.toISOString()}`);
				}

				return metadata;
			}
		}

		const result = await createAndSaveThumbnailForMenuItem(request);
		thumbnailDataByMenuItemId.set(request.id, result);
		return result;
	});
}

const loadThumbnailsPromise = isMainThread ? Promise.resolve() : loadExistingThumbnailsOnBoot();

loadThumbnailsPromise
	.catch(err => logError('[Thumbnail Thread] Failed to load thumbnail data', err));

export const THUMBNAIL_THREAD_HANDLER = new WorkerThreadCommandHandler(new URL(import.meta.url), {
	getThumbnailData
});