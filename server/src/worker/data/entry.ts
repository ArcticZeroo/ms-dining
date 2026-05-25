/**
 * Worker thread entry point for all DB/data operations.
 * Spawned by the main thread's WorkerThreadHandler.
 */
import { WorkerThreadHandler } from '../rpc/handler.js';
import { DATA_SERVICES } from './data-services.js';
import { runPendingMigrations } from './runtime-migrations/runner.js';
import { registerDataWorkerEventBridge } from './storage/events.js';

await runPendingMigrations();
registerDataWorkerEventBridge();

// WorkerThreadHandler self-registers as a parentPort listener
// when constructed outside the main thread.
const _handler = new WorkerThreadHandler(new URL(import.meta.url), DATA_SERVICES);
