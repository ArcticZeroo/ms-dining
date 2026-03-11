import { usePrismaClient } from '../api/storage/client.js';

const migrations = await usePrismaClient(client => client.runtimeMigration.findMany());

console.table(migrations.map(m => ({
	name:        m.name,
	status:      m.status,
	completedAt: m.completedAt?.toISOString() ?? '-',
	error:       m.error ?? '-',
})));

process.exit(0);
