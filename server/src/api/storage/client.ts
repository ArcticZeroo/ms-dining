import { PrismaClient } from '@prisma/client';
import Semaphore from 'semaphore-async-await';

// According to docs, perf can be very bad if we make parallel requests to SQLite
const databaseLock = new Semaphore.Lock();

const prismaClient = new PrismaClient();

export const usePrismaClient = async <T>(callback: (client: PrismaClient) => Promise<T>) => {
    try {
        await databaseLock.acquire();
        return callback(prismaClient);
    } finally {
        databaseLock.release();
    }
};