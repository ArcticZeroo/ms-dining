import { WorkerThreadCommandHandler } from './commanding.js';
import { isMainThread } from 'node:worker_threads';
import * as fs from 'node:fs/promises';
import { serverMenuItemThumbnailPath } from '../../constants/config.js';
import { logDebug, logError, logInfo } from '../../util/log.js';
import { retrieveImageMetadataAsync } from '../../util/image.js';
import path from 'path';
import { IThumbnailWorkerRequest } from '../../models/thumbnail.js';
import { createAndSaveThumbnailForMenuItem, IThumbnailResult } from '../cafe/image/thumbnail.js';
import { MultiLock } from '../lock/lock.js';
import { loadManifest, saveManifestDebounced, updateManifestEntry } from '../cafe/image/manifest.js';

const thumbnailDataByMenuItemId = new Map<string, IThumbnailResult>();
const THUMBNAIL_SEMAPHORE_BY_ID = new MultiLock();

const loadExistingThumbnailsOnBoot = async () => {
    console.time('thumbnail loading on boot');

    const manifest = await loadManifest();

    // Always scan the directory to find files missing from manifest
    const files = await fs.readdir(serverMenuItemThumbnailPath);
    const pngFiles = files.filter(f => f.endsWith('.png'));

    let loadedFromManifest = 0;
    let loadedFromDisk = 0;

    for (const fileNode of pngFiles) {
        const id = fileNode.replace('.png', '');

        const manifestEntry = manifest[id];
        if (manifestEntry) {
            // Fast path: use cached manifest data
            thumbnailDataByMenuItemId.set(id, {
                width:          manifestEntry.width,
                height:         manifestEntry.height,
                lastUpdateTime: new Date(manifestEntry.lastUpdateTime),
                hash:           manifestEntry.hash
            });
            loadedFromManifest++;
        } else {
            // Slow path: file exists on disk but not in manifest — read metadata
            const metadata = await retrieveImageMetadataAsync(path.join(serverMenuItemThumbnailPath, fileNode));
            if (!metadata) {
                continue;
            }

            thumbnailDataByMenuItemId.set(id, {
                ...metadata,
                hash: ''
            });
            loadedFromDisk++;
        }
    }

    if (loadedFromDisk > 0) {
        logInfo(`[Thumbnail Thread] ${loadedFromDisk} thumbnail(s) on disk missing from manifest — will be hashed on next access`);
    }

    logInfo(`[Thumbnail Thread] Loaded ${loadedFromManifest} from manifest, ${loadedFromDisk} from disk (${pngFiles.length} total files)`);
    console.timeEnd('thumbnail loading on boot');
}

const getThumbnailData = async (request: IThumbnailWorkerRequest): Promise<IThumbnailResult | null> => {
    await loadThumbnailsPromise;
    return THUMBNAIL_SEMAPHORE_BY_ID.acquire(request.id, async () => {
        if (thumbnailDataByMenuItemId.has(request.id)) {
            const metadata = thumbnailDataByMenuItemId.get(request.id)!;
            if (request.lastUpdateTime == null || metadata.lastUpdateTime.getTime() >= request.lastUpdateTime.getTime()) {
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