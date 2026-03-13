import { PrismaClient } from '@prisma/client';
import { PrismaTransactionClient } from '../../models/prisma.js';
import { getDbPriority } from './db-context.js';
import { PriorityLock } from './priority-lock.js';

// According to docs, perf can be very bad if we make parallel requests to SQLite
const databaseLock = new PriorityLock();

const prismaClient = new PrismaClient();

export const usePrismaClient = async <T>(callback: (client: PrismaClient) => Promise<T>) => {
    const priority = getDbPriority();
    return databaseLock.acquire(priority, () => callback(prismaClient));
};

export const usePrismaTransaction = async <T>(callback: (tx: PrismaTransactionClient) => Promise<T>) => {
    return usePrismaClient(async (client) => {
        return client.$transaction(async (tx) => {
            return callback(tx);
        });
    });
}