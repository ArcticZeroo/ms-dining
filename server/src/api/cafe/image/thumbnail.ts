import Jimp from 'jimp';
import { imageSize as getImageSizeSync } from 'image-size';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { promisify } from 'node:util';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { defaultUserAgent } from '../../../constants/http.js';
import { IMenuItem } from '../../../models/cafe.js';
import { runPromiseWithRetries } from '../../../util/async.js';

const maxThumbnailHeightPx = 200;
const loadImageRetries = 2;

const getImageSizeAsync = promisify(getImageSizeSync);

export const loadImageData = async (url: string): Promise<Buffer> => {
    const response = await runPromiseWithRetries(() => fetch(url, {
        headers: {
            'User-Agent': defaultUserAgent
        }
    }), loadImageRetries);

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
}

// static/menu-items/thumbnail/<id>
export const getThumbnailFilepath = (id: string) => path.join(serverMenuItemThumbnailPath, `${id}.png`);

interface IThumbnailData {
    hasThumbnail: boolean;
    thumbnailWidth?: number;
    thumbnailHeight?: number;
}

export const retrieveExistingThumbnailData = async (id: string, existingThumbnailData?: IThumbnailData): Promise<IThumbnailData> => {
    const thumbnailPath = getThumbnailFilepath(id);

    if (!fs.existsSync(thumbnailPath)) {
        return {
            hasThumbnail: false
        };
    }

    if (existingThumbnailData?.thumbnailWidth && existingThumbnailData?.thumbnailHeight) {
        return {
            hasThumbnail:    true,
            thumbnailWidth:  existingThumbnailData.thumbnailWidth,
            thumbnailHeight: existingThumbnailData.thumbnailHeight
        };
    }

    try {
        const { width, height } = await getImageSizeAsync(thumbnailPath);
        return {
            hasThumbnail:    true,
            thumbnailWidth:  width,
            thumbnailHeight: height
        };
    } catch (err) {
        // Could not read file?
        return {
            hasThumbnail: false
        };
    }
}

export const createAndSaveThumbnailForMenuItem = async (menuItem: IMenuItem): Promise<void> => {
    if (!menuItem.imageUrl || (menuItem.hasThumbnail && menuItem.thumbnailWidth && menuItem.thumbnailHeight)) {
        return;
    }

    // May have been created on a previous day/run
    const thumbnailData = await retrieveExistingThumbnailData(menuItem.id, menuItem /*existingThumbnailData*/);
    if (thumbnailData.hasThumbnail) {
        menuItem.hasThumbnail = true;
        menuItem.thumbnailWidth = thumbnailData.thumbnailWidth;
        menuItem.thumbnailHeight = thumbnailData.thumbnailHeight;
        return;
    }

    const imageData = await loadImageData(menuItem.imageUrl);
    const image = await Jimp.read(imageData);

    const { height } = image.bitmap;
    const scale = maxThumbnailHeightPx / height;

    image.scale(scale);

    await image.writeAsync(getThumbnailFilepath(menuItem.id));

    menuItem.thumbnailWidth = image.getWidth();
    menuItem.thumbnailHeight = image.getHeight();
}