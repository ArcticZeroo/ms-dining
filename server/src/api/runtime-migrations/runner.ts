import { usePrismaClient } from '../storage/client.js';
import { getNamespaceLogger } from '../../util/log.js';
import { IRuntimeMigration } from './types.js';
import { runtimeMigrations } from './registry.js';

const logger = getNamespaceLogger('RuntimeMigrations');

const executeMigration = async (migration: IRuntimeMigration) => {
	const existing = await usePrismaClient(client =>
		client.runtimeMigration.findUnique({ where: { name: migration.name } })
	);

	if (existing?.status === 'completed') {
		logger.debug(`Skipping already-completed migration: ${migration.name}`);
		return;
	}

	// Upsert as "running" so we don't re-run on concurrent startups
	await usePrismaClient(client =>
		client.runtimeMigration.upsert({
			where:  { name: migration.name },
			create: { name: migration.name, status: 'running' },
			update: { status: 'running', error: null },
		})
	);

	logger.info(`Running migration: ${migration.name}`);

	try {
		await migration.run();

		await usePrismaClient(client =>
			client.runtimeMigration.update({
				where: { name: migration.name },
				data:  { status: 'completed', completedAt: new Date() },
			})
		);

		logger.info(`Migration completed: ${migration.name}`);
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : String(err);

		await usePrismaClient(client =>
			client.runtimeMigration.update({
				where: { name: migration.name },
				data:  { status: 'failed', error: errorMessage },
			})
		);

		logger.error(`Migration failed: ${migration.name}`, errorMessage);
	}
};

export const runPendingMigrations = async () => {
	const blockingMigrations = runtimeMigrations.filter(m => m.runMode === 'blocking');
	const backgroundMigrations = runtimeMigrations.filter(m => m.runMode === 'background');

	for (const migration of blockingMigrations) {
		await executeMigration(migration);
	}

	for (const migration of backgroundMigrations) {
		// Fire-and-forget for background migrations
		executeMigration(migration)
			.catch(err => logger.error(`Unexpected error in background migration ${migration.name}:`, err));
	}
};
