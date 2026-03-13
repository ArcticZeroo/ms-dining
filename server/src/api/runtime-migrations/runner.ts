import { usePrismaClient } from '../storage/client.js';
import { logInfo, logError } from '../../util/log.js';
import { IRuntimeMigration } from './types.js';
import { MIGRATION_REGISTRY } from './registry.js';

export const runPendingMigrations = async () => {
    logInfo('[Migrations] Checking for pending runtime migrations...');

    const blockingMigrations = MIGRATION_REGISTRY.filter(m => m.runMode === 'blocking');
    const backgroundMigrations = MIGRATION_REGISTRY.filter(m => m.runMode === 'background');

    // Run blocking migrations sequentially, awaiting each
    for (const migration of blockingMigrations) {
        await runMigrationIfNeeded(migration);
    }

    // Fire off background migrations (don't await)
    for (const migration of backgroundMigrations) {
        runMigrationIfNeeded(migration).catch(err =>
            logError(`[Migrations] Background migration ${migration.name} failed:`, err)
        );
    }
};

const runMigrationIfNeeded = async (migration: IRuntimeMigration) => {
    const existing = await usePrismaClient(client =>
        client.runtimeMigration.findUnique({ where: { name: migration.name } })
    );

    if (existing?.status === 'completed') {
        return;
    }

    logInfo(`[Migrations] Running: ${migration.name} (${migration.runMode})...`);

    // Mark as running
    await usePrismaClient(client =>
        client.runtimeMigration.upsert({
            where:  { name: migration.name },
            create: { name: migration.name, status: 'running' },
            update: { status: 'running', error: null }
        })
    );

    try {
        await migration.run();

        await usePrismaClient(client =>
            client.runtimeMigration.update({
                where: { name: migration.name },
                data:  { status: 'completed', completedAt: new Date() }
            })
        );

        logInfo(`[Migrations] Completed: ${migration.name}`);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);

        await usePrismaClient(client =>
            client.runtimeMigration.update({
                where: { name: migration.name },
                data:  { status: 'failed', error: errorMessage }
            })
        ).catch(() => {});

        logError(`[Migrations] Failed: ${migration.name}:`, err);
        // Don't rethrow — let boot continue
    }
};
