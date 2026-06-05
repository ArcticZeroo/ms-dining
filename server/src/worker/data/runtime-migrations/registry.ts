import { IRuntimeMigration } from './types.js';
import { backfillStationNames } from './migrations/backfill-station-names.js';
import { deleteLegacyEmbeddings } from './migrations/delete-legacy-embeddings.js';
import { backfillThumbnailHashesMigration } from './migrations/backfill-thumbnail-hashes.js';
import { rehashThumbnailsSharpMigration } from './migrations/rehash-thumbnails-sharp.js';
import { fixEmptySnapshotCategories } from './migrations/fix-empty-snapshot-categories.js';

export const MIGRATION_REGISTRY: IRuntimeMigration[] = [
    backfillStationNames,
    backfillThumbnailHashesMigration,
    rehashThumbnailsSharpMigration,
    fixEmptySnapshotCategories,
    deleteLegacyEmbeddings,
];
