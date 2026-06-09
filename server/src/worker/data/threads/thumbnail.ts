import { isOfflineModeEnabled } from '../../../shared/constants/env.js';
import { WorkerThreadHandler } from '../../rpc/handler.js';
import * as fs from 'node:fs/promises';
import { serverMenuItemThumbnailPath } from '../../../shared/constants/config.js';
import { logError, logInfo } from '../../../shared/util/log.js';
import { retrieveImageMetadataAsync } from '../../../shared/util/image.js';
import path from 'path';
import { IThumbnailWorkerRequest } from '../../../shared/models/thumbnail.js';
import { createAndSaveThumbnailForMenuItem, IThumbnailResult } from '../cafe/image/thumbnail.js';
import { MultiLock } from '@frozor/lock';
import { loadManifest, saveManifestDebounced, updateManifestEntry } from '../cafe/image/manifest.js';
import { isWorkerEntryModule } from '../../rpc/worker-identity.js';

const thumbnailDataByMenuItemId = new Map<string, IThumbnailResult>();
const THUMBNAIL_SEMAPHORE_BY_ID = new MultiLock();

const loadExistingThumbnailsOnBoot = async () => {
    console.time('thumbnail loading on boot');

    const manifest = await loadManifest();

    // Always scan the directory to find files missing from manifest
    const files = await fs.readdir(serverMenuItemThumbnailPath);
    const pngFiles = files.filter(file => file.endsWith('.png'));

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

/**
 * Determines whether cached thumbnail metadata is still up-to-date
 * relative to the source's lastUpdateTime.
 *
 * Returns true (cache hit) when:
 *  - The request carries no lastUpdateTime (nothing to compare against), OR
 *  - The cached metadata's lastUpdateTime is >= the request's lastUpdateTime
 */
export const isThumbnailUpToDate = (cachedLastUpdateTime: Date, requestLastUpdateTime: Date | null | undefined): boolean => {
    if (requestLastUpdateTime == null) {
        return true;
    }
    return cachedLastUpdateTime.getTime() >= requestLastUpdateTime.getTime();
};

const getThumbnailData = async (request: IThumbnailWorkerRequest): Promise<IThumbnailResult | null> => {
    if (isOfflineModeEnabled) {
        return null;
    }

    await loadThumbnailsPromise;
    return THUMBNAIL_SEMAPHORE_BY_ID.acquire(request.id, async () => {
        if (thumbnailDataByMenuItemId.has(request.id)) {
            const metadata = thumbnailDataByMenuItemId.get(request.id)!;
            if (isThumbnailUpToDate(metadata.lastUpdateTime, request.lastUpdateTime)) {
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

const loadThumbnailsPromise = isWorkerEntryModule(new URL(import.meta.url)) ? loadExistingThumbnailsOnBoot() : Promise.resolve();

loadThumbnailsPromise
    .catch(err => logError('[Thumbnail Thread] Failed to load thumbnail data', err));

export const THUMBNAIL_THREAD_HANDLER = new WorkerThreadHandler(new URL(import.meta.url), {
    thumbnail: {
        getThumbnailData,
    },
});