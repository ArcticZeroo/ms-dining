import { createCanvas, loadImage } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { IMenuItem } from '../../../models/cafe.js';
import { getRotationDegreesClockwise, loadImageData } from './load.js';

export const getCanvasSize = (width: number, height: number, rotationDegrees: number): [number, number] => {
    if (rotationDegrees % 90 !== 0) {
        throw new Error(`Rotation must be a multiple of 90 degrees, got ${rotationDegrees}`);
    }

    if (rotationDegrees % 180 === 0) {
        return [
            width,
            height
        ];
    } else {
        return [
            height,
            width
        ];
    }
}

export const createThumbnailStream = async (url: string, maxHeightPx: number) => {
    const imageData = await loadImageData(url);
    const image = await loadImage(Buffer.from(imageData.data));

    const scale = maxHeightPx / image.height;

    const finalWidth = Math.floor(image.width * scale);
    const finalHeight = Math.floor(image.height * scale);

    const rotationDegrees = getRotationDegreesClockwise(imageData.tags);
    const [canvasWidth, canvasHeight] = getCanvasSize(finalWidth, finalHeight, rotationDegrees);

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    if (rotationDegrees != 0) {
        // Rotate around canvas center, then move back to the top left
        ctx.translate(canvasWidth / 2, canvasHeight / 2);
        ctx.rotate(rotationDegrees * Math.PI / 180);
        ctx.translate(-canvasWidth / 2, -canvasHeight / 2);
    }

    ctx.drawImage(image, 0, 0, finalWidth, finalHeight);

    return canvas.createPNGStream();
};

const maxThumbnailHeightPx = 200;

// static/menu-items/thumbnail/<id>
export const createAndSaveThumbnailForMenuItem = async (menuItem: IMenuItem): Promise<void> => {
    if (!menuItem.imageUrl || menuItem.hasThumbnail) {
        return;
    }

    const pngStream = await createThumbnailStream(menuItem.imageUrl, maxThumbnailHeightPx);
    const fileWriteStream = fs.createWriteStream(path.join(serverMenuItemThumbnailPath, `${menuItem.id}.png`));

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