import { WorkerThreadCommandHandler } from './commanding.js';
import { isMainThread } from 'node:worker_threads';
import * as fs from 'node:fs/promises';
import { serverMenuItemThumbnailPath } from '../../constants/config.js';
import { logDebug, logError, logInfo } from '../../util/log.js';
import { retrieveImageMetadataAsync } from '../../util/image.js';
import path from 'path';
import { IThumbnailWorkerRequest } from '../../models/thumbnail.js';
import { createAndSaveThumbnailForMenuItem, IThumbnailResult } from '../cafe/image/thumbnail.js';
import { MultiLock } from '../lock.js';
import { loadManifest, saveManifestDebounced, updateManifestEntry } from '../cafe/image/manifest.js';

const thumbnailDataByMenuItemId = new Map<string, IThumbnailResult>();
const THUMBNAIL_SEMAPHORE_BY_ID = new MultiLock();

const loadExistingThumbnailsOnBoot = async () => {
	console.time('thumbnail loading on boot');

	const manifest = await loadManifest();
	const manifestEntryCount = Object.keys(manifest).length;

	if (manifestEntryCount > 0) {
		// Fast path: load from manifest
		for (const [id, entry] of Object.entries(manifest)) {
			thumbnailDataByMenuItemId.set(id, {
				width:          entry.width,
				height:         entry.height,
				lastUpdateTime: new Date(entry.lastUpdateTime),
				hash:           entry.hash
			});
		}
		logInfo(`[Thumbnail Thread] Loaded ${manifestEntryCount} thumbnails from manifest`);
	} else {
		// Fallback: scan files on disk
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

			thumbnailDataByMenuItemId.set(id, {
				...metadata,
				hash: ''
			});
		}

		logInfo(`[Thumbnail Thread] Loaded ${thumbnailDataByMenuItemId.size} thumbnails from disk (no manifest)`);
	}

	console.timeEnd('thumbnail loading on boot');
}

const getThumbnailData = async (request: IThumbnailWorkerRequest): Promise<IThumbnailResult | null> => {
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

		updateManifestEntry(request.id, {
			hash:           result.hash,
			width:          result.width,
			height:         result.height,
			lastUpdateTime: result.lastUpdateTime.toISOString()
		});
		// Save manifest asynchronously - debounced to avoid concurrent writes
		saveManifestDebounced();

		return result;
	});
}

const loadThumbnailsPromise = isMainThread ? Promise.resolve() : loadExistingThumbnailsOnBoot();

loadThumbnailsPromise
	.catch(err => logError('[Thumbnail Thread] Failed to load thumbnail data', err));

export const THUMBNAIL_THREAD_HANDLER = new WorkerThreadCommandHandler(new URL(import.meta.url), {
	getThumbnailData
});