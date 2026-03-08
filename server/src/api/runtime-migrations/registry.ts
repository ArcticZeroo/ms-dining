import { IRuntimeMigration } from './types.js';
import { backfillThumbnailHashesMigration } from './migrations/backfill-thumbnail-hashes.js';

export const runtimeMigrations: IRuntimeMigration[] = [
	backfillThumbnailHashesMigration,
];
