import Jimp from 'jimp';
import * as path from 'path';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { defaultUserAgent } from '../../../constants/http.js';
import { IMenuItem } from '../../../models/cafe.js';
import { runPromiseWithRetries } from '../../../util/async.js';

const maxThumbnailHeightPx = 200;
const loadImageRetries = 2;

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
export const createAndSaveThumbnailForMenuItem = async (menuItem: IMenuItem): Promise<void> => {
    if (!menuItem.imageUrl || menuItem.hasThumbnail) {
        return;
    }

    const imageData = await loadImageData(menuItem.imageUrl);
    const image = await Jimp.read(imageData);

    const { height } = image.bitmap;
    const scale = maxThumbnailHeightPx / height;

    image.scale(scale);

    const outputPath = path.join(serverMenuItemThumbnailPath, `${menuItem.id}.png`);
    await image.writeAsync(outputPath);
}