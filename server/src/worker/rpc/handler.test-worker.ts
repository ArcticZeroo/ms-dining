/**
 * Tiny worker entry used only by handler.test.ts to validate the
 * cross-thread transport end-to-end. Mirrors the shape a real
 * worker-db/entry.ts will have: import the services, construct a
 * WorkerThreadHandler with them, done — the handler self-registers as
 * a parentPort listener when constructed outside the main thread.
 */
import { WorkerThreadHandler } from './handler.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../shared/rpc/errors.js';
import { ServiceMap } from './service-map.js';

const TEST_SERVICES = {
    echo: {
        roundTrip: async (data: { value: string; nested: { items: number[] } }) => {
            return { received: data };
        },
        sum: async (data: { numbers: number[] }) => {
            return data.numbers.reduce((acc, value) => acc + value, 0);
        },
    },
    fail: {
        withServiceError: async () => {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'gone', { id: 'abc' });
        },
        withPlainError: async () => {
            throw new Error('plain boom');
        },
    },
} satisfies ServiceMap;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _handler = new WorkerThreadHandler(new URL(import.meta.url), TEST_SERVICES);
