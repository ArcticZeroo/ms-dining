import { usePrismaWrite } from '../worker/data/storage/client.js';

await usePrismaWrite(client => client.runtimeMigration.update({
    where: { name: 'backfill-thumbnail-hashes' },
    data:  { status: 'pending', completedAt: null, error: null }
}));

console.log('Reset backfill-thumbnail-hashes to pending. Restart the server to re-run.');
process.exit(0);
