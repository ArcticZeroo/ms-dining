import { createCanvas, loadImage } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { IMenuItem } from '../../../models/cafe.js';
import { runPromiseWithRetries } from '../../../util/async.js';

const loadImageRetries = 2;

export const createThumbnailStream = async (url: string, maxHeightPx: number) => {
    const image = await runPromiseWithRetries(() => loadImage(url), loadImageRetries);

    const scale = maxHeightPx / image.height;

    const finalWidth = Math.floor(image.width * scale);
    const finalHeight = Math.floor(image.height * scale);

    const canvas = createCanvas(finalWidth, finalHeight);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(image, 0, 0, finalWidth, finalHeight);

    return canvas.createPNGStream();
};

const maxThumbnailHeightPx = 200;

// static/menu-items/thumbnail/<id>
export const createAndSaveThumbnailForMenuItem = async (menuItem: IMenuItem): Promise<void> => {
    if (!menuItem.imageUrl || menuItem.hasThumbnail) {
        return;
    }

    const fileWriteStream = fs.createWriteStream(path.join(serverMenuItemThumbnailPath, `${menuItem.id}.png`));
    const pngStream = await createThumbnailStream(menuItem.imageUrl, maxThumbnailHeightPx);

    return new Promise((resolve, reject) => {
        const onError = (err: unknown) => {
            cleanup();

            reject(err);
        };

        const onFinish = () => {
            cleanup();

            menuItem.hasThumbnail = true;

            resolve();
        };

        const cleanup = () => {
            fileWriteStream.removeListener('error', onError);
            fileWriteStream.removeListener('finish', onFinish);
        };

        fileWriteStream.once('error', onError);
        fileWriteStream.once('finish', onFinish);
        pngStream.pipe(fileWriteStream);
    });
}