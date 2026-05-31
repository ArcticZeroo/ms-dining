import { Prisma } from '@prisma/client';
import { usePrismaTransaction, usePrismaWrite } from '../../client.js';
import type { ISessionData } from '../../../../../shared/services/session-store.js';
import type { ISessionService } from '../../../../../shared/services/session.js';

export abstract class SessionStorageClient {
    static async getSession(sessionId: string): Promise<ISessionData | undefined> {
        return usePrismaTransaction(async (prisma) => {
            const session = await prisma.session.findUnique({
                where: { id: sessionId }
            });

            if (!session) {
                return undefined;
            }

            // Check if session has expired (only if expiresAt is set)
            if (session.expiresAt && session.expiresAt < new Date()) {
                await prisma.session.delete({
                    where: { id: sessionId }
                });
                return undefined;
            }

            return {
                passport: {
                    user: session.userId
                }
            };
        });
    }

    static async upsertSession(sessionId: string, sessionData: ISessionData, maxAge?: number): Promise<void> {
        // Only save to database if we have authentication data
        // koa-session calls this with just metadata before authentication
        if (!sessionData.passport?.user) {
            return;
        }

        const userId = sessionData.passport.user;
        const expiresAt = maxAge ? new Date(Date.now() + maxAge) : null;

        return usePrismaWrite(async (prisma) => {
            await prisma.session.upsert({
                where: { id: sessionId },
                update: {
                    expiresAt,
                    userId
                },
                create: {
                    id: sessionId,
                    expiresAt,
                    userId
                }
            });
        });
    }

    static async destroySession(sessionId: string): Promise<void> {
        try {
            await usePrismaWrite(async (prisma) => {
                await prisma.session.delete({
                    where: { id: sessionId }
                });
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
                return;
            }
            throw error;
        }
    }
}

export const sessionServiceCommands = {
    get: async ({ sessionId }: { sessionId: string }) =>
        SessionStorageClient.getSession(sessionId),
    set: async ({ sessionId, sessionData, maxAge }: { sessionId: string; sessionData: ISessionData; maxAge?: number }) =>
        SessionStorageClient.upsertSession(sessionId, sessionData, maxAge),
    destroy: async ({ sessionId }: { sessionId: string }) =>
        SessionStorageClient.destroySession(sessionId),
} satisfies ISessionService;
