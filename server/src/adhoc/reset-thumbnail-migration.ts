import { usePrismaClient } from '../api/storage/client.js';

await usePrismaClient(client => client.runtimeMigration.update({
	where: { name: 'backfill-thumbnail-hashes' },
	data:  { status: 'pending', completedAt: null, error: null }
}));

console.log('Reset backfill-thumbnail-hashes to pending. Restart the server to re-run.');
process.exit(0);
