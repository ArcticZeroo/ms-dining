import { promisify } from 'node:util';
import { imageSize as getImageSizeSync } from 'image-size';
import fs from 'node:fs/promises';
import { logError } from './log.js';

const getImageSizeAsync = promisify(getImageSizeSync);

export interface IImageMetadata {
	width: number;
	height: number;
	lastUpdateTime: Date;
}

export const retrieveImageMetadataAsync = async (imagePath: string): Promise<IImageMetadata | null> => {
	try {
		const [imageSizeResult, { mtime: lastUpdateTime }] = await Promise.all([getImageSizeAsync(imagePath), fs.stat(imagePath)]);

		if (imageSizeResult == null) {
			return null;
		}

		const { width, height } = imageSizeResult;

		if (width == null || height == null) {
			return null;
		}

		return {
			width,
			height,
			lastUpdateTime
		};
	} catch (err) {
		logError('Could not get image metadata:', err);

		if (String(err).includes('Empty file')) {
			await fs.rm(imagePath);
		}

		return null;
	}
}