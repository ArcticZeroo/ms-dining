import { usePrismaClient } from '../worker/data/storage/client.js';

const migrations = await usePrismaClient(client => client.runtimeMigration.findMany());

console.table(migrations.map(migration => ({
    name:        migration.name,
    status:      migration.status,
    completedAt: migration.completedAt?.toISOString() ?? '-',
    error:       migration.error ?? '-',
})));

process.exit(0);
