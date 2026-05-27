import sharp from 'sharp';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { serverMenuItemThumbnailPath, serverThumbnailPath } from '../../../../shared/constants/config.js';
import { defaultUserAgent } from '../../../../shared/constants/http.js';
import { runPromiseWithRetries } from '../../../../shared/util/async.js';
import { logDebug } from '../../../../shared/util/log.js';
import { IThumbnailWorkerRequest } from '../../../../shared/models/thumbnail.js';
import { IImageMetadata } from '../../../../shared/util/image.js';
import { updateManifestEntry } from './manifest.js';

const maxThumbnailHeightPx = 200;
const maxThumbnailWidthPx = 400;
const loadImageRetries = 2;
const loadImageRetryDelayMs = 100;

const DHASH_WIDTH = 9;
const DHASH_HEIGHT = 8;

export interface IThumbnailResult extends IImageMetadata {
	hash: string;
}

/**
 * Compute a difference hash (dHash) for perceptual image comparison.
 * Resizes to 9x8 grayscale, compares adjacent pixels per row to produce a 64-bit hash.
 */
export const computeDHash = async (imageInput: Buffer | string): Promise<string> => {
    const { data } = await sharp(imageInput)
        .greyscale()
        .resize(DHASH_WIDTH, DHASH_HEIGHT, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

    let hash = BigInt(0);

    for (let y = 0; y < DHASH_HEIGHT; y++) {
        for (let x = 0; x < DHASH_WIDTH - 1; x++) {
            const leftPixel = data[y * DHASH_WIDTH + x]!;
            const rightPixel = data[y * DHASH_WIDTH + x + 1]!;

            hash <<= BigInt(1);
            if (leftPixel > rightPixel) {
                hash |= BigInt(1);
            }
        }
    }

    return hash.toString(16).padStart(16, '0');
};

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

// static/thumbnails/<hash>
export const getHashThumbnailFilepath = (hash: string) => path.join(serverThumbnailPath, `${hash}.png`);

export const computeHashFromExistingImage = async (id: string, imagePath: string): Promise<{ hash: string; width: number; height: number }> => {
    const metadata = await sharp(imagePath).metadata();
    const hash = await computeDHash(imagePath);
    const width = metadata.width!;
    const height = metadata.height!;
    updateManifestEntry(id, { hash, width, height, lastUpdateTime: new Date().toISOString() });
    return { hash, width, height };
};

export interface IProcessedThumbnail extends IThumbnailResult {
    pngBuffer: Buffer;
}

export const processImageToThumbnail = async (imageData: Buffer): Promise<IProcessedThumbnail> => {
    const image = sharp(imageData);
    const metadata = await image.metadata();
    const { height: origHeight, width: origWidth } = metadata;

    if (!origHeight || !origWidth) {
        throw new Error('Could not determine image dimensions');
    }

    const scale = Math.min(maxThumbnailHeightPx / origHeight, maxThumbnailWidthPx / origWidth);
    const width = Math.round(origWidth * scale);
    const height = Math.round(origHeight * scale);

    const resized = image.resize(width, height);
    const pngBuffer = await resized.png().toBuffer();

    const hash = await computeDHash(pngBuffer);

    return {
        width,
        height,
        lastUpdateTime: new Date(),
        hash,
        pngBuffer
    };
};

export const createAndSaveThumbnailForMenuItem = async (request: IThumbnailWorkerRequest): Promise<IThumbnailResult> => {
    const imageData = await loadImageData(request.imageUrl);
    const { pngBuffer, ...result } = await processImageToThumbnail(imageData);

    // Save to old path (backward compat)
    await fs.writeFile(getThumbnailFilepath(request.id), pngBuffer);

    // Save to new hash-based path (always overwrite — collision rate is negligible)
    await fs.mkdir(serverThumbnailPath, { recursive: true });
    await fs.writeFile(getHashThumbnailFilepath(result.hash), pngBuffer);

    return result;
};