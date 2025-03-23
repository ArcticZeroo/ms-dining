import Jimp from 'jimp';
import { imageSize as getImageSizeSync } from 'image-size';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { promisify } from 'node:util';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { defaultUserAgent } from '../../../constants/http.js';
import { IMenuItem } from '../../../models/cafe.js';
import { runPromiseWithRetries } from '../../../util/async.js';
import { logDebug, logError } from '../../../util/log.js';
import { IThumbnailWorkerCompletionNotification, IThumbnailWorkerRequest } from '../../../models/thumbnail-worker.js';
import { Nullable } from '../../../models/util.js';

const maxThumbnailHeightPx = 200;
const maxThumbnailWidthPx = 400;
const loadImageRetries = 2;
const loadImageRetryDelayMs = 1000;

const getImageSizeAsync = promisify(getImageSizeSync);

export const loadImageData = async (url: string): Promise<Buffer> => {
    logDebug(`[Thumbnail] Loading image data from ${encodeURI(url)}`);

    const response = await runPromiseWithRetries(
        () => fetch(url, {
            headers: {
                'User-Agent': defaultUserAgent
            }
        }),
        loadImageRetries,
        loadImageRetryDelayMs
    );

    if (!response.ok) {
        let text;
        try {
            text = await response.text();
        } catch {
            throw new Error(`Response failed with status: ${response.status}, could not deserialize text`);
        }
        throw new Error(`Response failed with status: ${response.status}, text: ${text}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
};

// static/menu-items/thumbnail/<id>
export const getThumbnailFilepath = (id: string) => path.join(serverMenuItemThumbnailPath, `${id}.png`);

interface IThumbnailExistsData {
    hasThumbnail: true;
    thumbnailWidth: number;
    thumbnailHeight: number;
    lastUpdateTime?: Date;
}

interface IThumbnailDoesNotExistData {
    hasThumbnail: false;
}

type IThumbnailData = IThumbnailExistsData | IThumbnailDoesNotExistData;

export const retrieveExistingThumbnailData = async (id: string): Promise<IThumbnailData> => {
    const thumbnailPath = getThumbnailFilepath(id);

    if (!fs.existsSync(thumbnailPath)) {
        logDebug('Thumbnail for id', id, 'does not exist');
        return {
            hasThumbnail: false
        };
    }

    try {
        const imageSizeResult = await getImageSizeAsync(thumbnailPath);

        if (imageSizeResult == null) {
            return {
                hasThumbnail: false
            };
        }

        const { width, height } = imageSizeResult;
        const { mtime: fileLastUpdateTime } = await fsPromises.stat(thumbnailPath);

        if (width == null || height == null) {
            logError('Could not get thumbnail stats:', imageSizeResult);
            return {
                hasThumbnail: false
            };
        }

        return {
            hasThumbnail:    true,
            thumbnailWidth:  width,
            thumbnailHeight: height,
            lastUpdateTime:  fileLastUpdateTime
        };
    } catch (err) {
        logError('Could not get thumbnail stats:', err);

        // Could not read file?
        return {
            hasThumbnail: false
        };
    }
};

const isThumbnailUpToDate = (thumbnailData: IThumbnailData, requestLastUpdateTime: Nullable<Date>): boolean => {
    if (!thumbnailData.hasThumbnail || !thumbnailData.lastUpdateTime) {
        return false;
    }

    if (!requestLastUpdateTime) {
        return false;
    }

    return thumbnailData.lastUpdateTime.getTime() >= requestLastUpdateTime.getTime();
}

export const createAndSaveThumbnailForMenuItem = async (request: IThumbnailWorkerRequest): Promise<IThumbnailWorkerCompletionNotification> => {
    // May have been created on a previous day/run
    const thumbnailData = await retrieveExistingThumbnailData(request.id);
    if (thumbnailData.hasThumbnail && isThumbnailUpToDate(thumbnailData, request.lastUpdateTime)) {
        return {
            id: request.id,
            thumbnailWidth: thumbnailData.thumbnailWidth,
            thumbnailHeight: thumbnailData.thumbnailHeight
        };
    }

    const imageData = await loadImageData(request.imageUrl);
    const image = await Jimp.read(imageData);

    const { height, width } = image.bitmap;
    const scale = Math.min(maxThumbnailHeightPx / height, maxThumbnailWidthPx / width);

    image.scale(scale);

    await image.writeAsync(getThumbnailFilepath(request.id));

    return {
        id: request.id,
        thumbnailWidth: image.getWidth(),
        thumbnailHeight: image.getHeight()
    };
};