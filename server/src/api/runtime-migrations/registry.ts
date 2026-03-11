import { IRuntimeMigration } from './types.js';
import { backfillStationNames } from './migrations/backfill-station-names.js';
import { deleteLegacyStationEmbeddings } from './migrations/delete-legacy-station-embeddings.js';
import { backfillThumbnailHashesMigration } from './migrations/backfill-thumbnail-hashes.js';

export const MIGRATION_REGISTRY: IRuntimeMigration[] = [
	deleteLegacyStationEmbeddings,
	backfillStationNames,
    backfillThumbnailHashesMigration,
];
