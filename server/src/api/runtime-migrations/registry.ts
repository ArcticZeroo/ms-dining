import { IRuntimeMigration } from './types.js';
import { backfillStationNames } from './migrations/backfill-station-names.js';

export const MIGRATION_REGISTRY: IRuntimeMigration[] = [
	backfillStationNames,
];
