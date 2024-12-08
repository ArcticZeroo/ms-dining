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

interface IThumbnailData {
    hasThumbnail: boolean;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
    lastUpdateTime?: Date;
}

export const retrieveExistingThumbnailData = async (id: string, existingThumbnailData?: IThumbnailData): Promise<IThumbnailData> => {
    const thumbnailPath = getThumbnailFilepath(id);

    if (!fs.existsSync(thumbnailPath)) {
        logDebug('Thumbnail for id', id, 'does not exist');
        return {
            hasThumbnail: false
        };
    }

    const { mtime: fileLastUpdateTime } = await fsPromises.stat(thumbnailPath);

    if (existingThumbnailData?.hasThumbnail && existingThumbnailData?.thumbnailWidth && existingThumbnailData?.thumbnailHeight) {
        return {
            hasThumbnail:    true,
            thumbnailWidth:  existingThumbnailData.thumbnailWidth,
            thumbnailHeight: existingThumbnailData.thumbnailHeight,
            lastUpdateTime:  fileLastUpdateTime
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

const thumbnailDataFromMenuItem = (menuItem: IMenuItem): IThumbnailData => {
    if (menuItem.hasThumbnail) {
        return {
            hasThumbnail:    true,
            thumbnailWidth:  menuItem.thumbnailWidth || 0,
            thumbnailHeight: menuItem.thumbnailHeight || 0,
            lastUpdateTime:  menuItem.lastUpdateTime || new Date(0)
        };
    } else {
        return {
            hasThumbnail: false
        };
    }
};

const isThumbnailUpToDate = (thumbnailData: IThumbnailData, menuItem: IMenuItem): boolean => {
    if (!thumbnailData.hasThumbnail || !thumbnailData.lastUpdateTime) {
        logDebug(`Thumbnail for "${menuItem.name}" is out of date because previous data is missing.`);
        return false;
    }

    if (!menuItem.lastUpdateTime) {
        logDebug(`Thumbnail for "${menuItem.name}" is out of date because we don't know when the menu item was last updated.`);
        return false;
    }

    return thumbnailData.lastUpdateTime.getTime() >= menuItem.lastUpdateTime.getTime();
}

export const createAndSaveThumbnailForMenuItem = async (menuItem: IMenuItem): Promise<void> => {
    if (!menuItem.imageUrl || (menuItem.hasThumbnail && menuItem.thumbnailWidth && menuItem.thumbnailHeight)) {
        return;
    }

    // May have been created on a previous day/run
    const thumbnailData = await retrieveExistingThumbnailData(menuItem.id, thumbnailDataFromMenuItem(menuItem));
    if (thumbnailData.hasThumbnail && isThumbnailUpToDate(thumbnailData, menuItem)) {
        menuItem.hasThumbnail = true;
        menuItem.thumbnailWidth = thumbnailData.thumbnailWidth;
        menuItem.thumbnailHeight = thumbnailData.thumbnailHeight;
        return;
    }

    const imageData = await loadImageData(menuItem.imageUrl);
    const image = await Jimp.read(imageData);

    const { height, width } = image.bitmap;
    const scale = Math.min(maxThumbnailHeightPx / height, maxThumbnailWidthPx / width);

    image.scale(scale);

    await image.writeAsync(getThumbnailFilepath(menuItem.id));

    menuItem.thumbnailWidth = image.getWidth();
    menuItem.thumbnailHeight = image.getHeight();
};