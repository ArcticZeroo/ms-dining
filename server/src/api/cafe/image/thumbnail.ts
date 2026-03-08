import Jimp from 'jimp';
import * as path from 'node:path';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { defaultUserAgent } from '../../../constants/http.js';
import { runPromiseWithRetries } from '../../../util/async.js';
import { logDebug } from '../../../util/log.js';
import { IThumbnailWorkerRequest } from '../../../models/thumbnail.js';
import { IImageMetadata } from '../../../util/image.js';

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
export const computeDHash = (image: Jimp): string => {
	const resized = image.clone()
		.resize(DHASH_WIDTH, DHASH_HEIGHT)
		.greyscale();

	let hash = BigInt(0);

	for (let y = 0; y < DHASH_HEIGHT; y++) {
		for (let x = 0; x < DHASH_WIDTH - 1; x++) {
			const leftPixel = Jimp.intToRGBA(resized.getPixelColor(x, y));
			const rightPixel = Jimp.intToRGBA(resized.getPixelColor(x + 1, y));

			hash <<= BigInt(1);
			if (leftPixel.r > rightPixel.r) {
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

export const createAndSaveThumbnailForMenuItem = async (request: IThumbnailWorkerRequest): Promise<IThumbnailResult> => {
	const imageData = await loadImageData(request.imageUrl);
	const image = await Jimp.read(imageData);

	const { height, width } = image.bitmap;
	const scale = Math.min(maxThumbnailHeightPx / height, maxThumbnailWidthPx / width);

	image.scale(scale);

	const hash = computeDHash(image);

	await image.writeAsync(getThumbnailFilepath(request.id));

	return {
		width:          image.getWidth(),
		height:         image.getHeight(),
		lastUpdateTime: new Date(),
		hash
	};
};