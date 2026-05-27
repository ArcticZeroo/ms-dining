import sharp from 'sharp';
import fs from 'node:fs/promises';
import { logError } from './log.js';

export interface IImageMetadata {
	width: number;
	height: number;
	lastUpdateTime: Date;
}

export const retrieveImageMetadataAsync = async (imagePath: string): Promise<IImageMetadata | null> => {
    try {
        const [metadata, { mtime: lastUpdateTime }] = await Promise.all([sharp(imagePath).metadata(), fs.stat(imagePath)]);

        const { width, height } = metadata;

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