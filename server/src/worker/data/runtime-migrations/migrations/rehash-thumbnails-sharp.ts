import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { serverMenuItemThumbnailPath, serverThumbnailPath } from '../../../../shared/constants/config.js';
import { computeHashFromExistingImage } from '../../cafe/image/thumbnail.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item/menu-item.js';
import { saveManifest } from '../../cafe/image/manifest.js';
import { getNamespaceLogger } from '../../../../shared/util/log.js';
import { IRuntimeMigration } from '../types.js';

const logger = getNamespaceLogger('Migration:RehashThumbnailsSharp');

export const rehashThumbnailsSharpMigration: IRuntimeMigration = {
    name:        'rehash-thumbnails-sharp',
    description: 'Recompute dHash values using sharp (replacing Jimp) and update hash-keyed thumbnail files',
    runMode:     'background',
    async run() {
        let files: string[];
        try {
            files = await fs.readdir(serverMenuItemThumbnailPath);
        } catch {
            logger.info('Thumbnail directory does not exist, skipping.');
            return;
        }

        const pngFiles = files.filter(fileName => fileName.endsWith('.png'));
        logger.info(`Rehashing ${pngFiles.length} thumbnails with sharp...`);

        if (pngFiles.length === 0) {
            return;
        }

        await fs.mkdir(serverThumbnailPath, { recursive: true });

        let processed = 0;
        let errors = 0;

        for (const file of pngFiles) {
            const id = file.replace('.png', '');
            const filePath = path.join(serverMenuItemThumbnailPath, file);

            try {
                const { hash } = await computeHashFromExistingImage(id, filePath);
                await MenuItemStorageClient.updateThumbnailHash(id, hash);

                const hashFilePath = path.join(serverThumbnailPath, `${hash}.png`);
                await fs.copyFile(filePath, hashFilePath);

                processed++;
                if (processed % 100 === 0) {
                    logger.info(`Rehashed ${processed}/${pngFiles.length}...`);
                }
            } catch (err) {
                errors++;
                logger.error(`Error rehashing ${file}:`, err instanceof Error ? err.message : err);
            }
        }

        await saveManifest();
        logger.info(`Done: ${processed} rehashed, ${errors} errors.`);
    }
};
