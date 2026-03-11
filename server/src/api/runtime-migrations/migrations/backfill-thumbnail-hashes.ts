import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { serverMenuItemThumbnailPath, serverThumbnailPath } from '../../../constants/config.js';
import { updateThumbnailHashFromExistingImage } from '../../cafe/image/thumbnail.js';
import { saveManifest } from '../../cafe/image/manifest.js';
import { getNamespaceLogger } from '../../../util/log.js';
import { IRuntimeMigration } from '../types.js';

const logger = getNamespaceLogger('Migration:BackfillThumbnailHashes');

export const backfillThumbnailHashesMigration: IRuntimeMigration = {
	name:        'backfill-thumbnail-hashes',
	description: 'Scan all existing PNG thumbnails and compute dHash values for deduplication',
	runMode:     'background',
	async run() {
		logger.info('Scanning existing thumbnails and computing dHash values...');
		logger.info(`Thumbnail directory: ${serverMenuItemThumbnailPath}`);

		let files: string[];
		try {
			files = await fs.readdir(serverMenuItemThumbnailPath);
		} catch {
			logger.info('Thumbnail directory does not exist or is not readable, skipping.');
			return;
		}

		const pngFiles = files.filter(f => f.endsWith('.png'));
		logger.info(`Found ${pngFiles.length} PNG thumbnails.`);

		if (pngFiles.length === 0) {
			return;
		}

		await fs.mkdir(serverThumbnailPath, { recursive: true });

		const hashToIds = new Map<string, string[]>();
		let processed = 0;
		let errors = 0;

		for (const file of pngFiles) {
			const id = file.replace('.png', '');
			const filePath = path.join(serverMenuItemThumbnailPath, file);

			try {
				const hash = await updateThumbnailHashFromExistingImage(id, filePath);

				const existing = hashToIds.get(hash) ?? [];
				existing.push(id);
				hashToIds.set(hash, existing);

				// Copy to hash-based path, skip if already exists
				const hashFilePath = path.join(serverThumbnailPath, `${hash}.png`);
				try {
					await fs.copyFile(filePath, hashFilePath, fs.constants.COPYFILE_EXCL);
				} catch {
					// File already exists — expected for duplicates
				}

				processed++;
				if (processed % 100 === 0) {
					logger.info(`Processed ${processed}/${pngFiles.length}...`);
				}
			} catch (err) {
				errors++;
				logger.error(`Error processing ${file}:`, err instanceof Error ? err.message : err);
			}
		}

		await saveManifest();

		const duplicateGroups = Array.from(hashToIds.entries()).filter(([, ids]) => ids.length > 1);

		logger.info(`Completed: ${processed} processed, ${errors} errors, ${hashToIds.size} unique hashes, ${duplicateGroups.length} duplicate groups`);

		if (duplicateGroups.length > 0) {
			const totalDuplicateItems = duplicateGroups.reduce((sum, [, ids]) => sum + ids.length, 0);
			const savingsCount = totalDuplicateItems - duplicateGroups.length;
			logger.info(`Potential file savings: ${savingsCount} thumbnails across ${duplicateGroups.length} duplicate groups`);
		}
	}
};
