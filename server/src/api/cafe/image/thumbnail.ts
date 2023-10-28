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
export const getThumbnailPath = (menuItem: IMenuItem): string => path.join(serverMenuItemThumbnailPath, `${menuItem.id}.png`);

export const populateExistingThumbnailData = async (menuItem: IMenuItem): Promise<boolean> => {
    const thumbnailPath = getThumbnailPath(menuItem);
    if (!fs.existsSync(thumbnailPath)) {
        return false;
    }

    if (!menuItem.thumbnailHeight || !menuItem.thumbnailWidth) {
        const { width, height } = await getImageSizeAsync(thumbnailPath);
        menuItem.thumbnailWidth = width;
        menuItem.thumbnailHeight = height;
    }

    return true;
}

export const createAndSaveThumbnailForMenuItem = async (menuItem: IMenuItem): Promise<void> => {
    if (!menuItem.imageUrl || menuItem.hasThumbnail) {
        return;
    }

    // May have been created on a previous day/run
    const didExistingDataExist = await populateExistingThumbnailData(menuItem);
    if (didExistingDataExist) {
        return;
    }

    const imageData = await loadImageData(menuItem.imageUrl);
    const image = await Jimp.read(imageData);

    const { height } = image.bitmap;
    const scale = maxThumbnailHeightPx / height;

    image.scale(scale);

    await image.writeAsync(getThumbnailPath(menuItem));

    menuItem.thumbnailWidth = image.getWidth();
    menuItem.thumbnailHeight = image.getHeight();
}