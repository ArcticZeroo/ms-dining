import { IRuntimeMigration } from './types.js';
import { backfillStationNames } from './migrations/backfill-station-names.js';
import { deleteLegacyStationEmbeddings } from './migrations/delete-legacy-station-embeddings.js';
import { backfillThumbnailHashesMigration } from './migrations/backfill-thumbnail-hashes.js';
import { rehashThumbnailsSharpMigration } from './migrations/rehash-thumbnails-sharp.js';
import { fixEmptySnapshotCategories } from './migrations/fix-empty-snapshot-categories.js';

export const MIGRATION_REGISTRY: IRuntimeMigration[] = [
    deleteLegacyStationEmbeddings,
    backfillStationNames,
    backfillThumbnailHashesMigration,
    rehashThumbnailsSharpMigration,
    fixEmptySnapshotCategories,
];
