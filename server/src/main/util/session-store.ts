import { usePrismaClient, usePrismaWrite } from '../../api/storage/client.js';
import { z } from 'zod';
import type { ISessionService } from '../../shared/services/session.js';

const SessionDataSchema = z.object({
    passport: z.object({
        user: z.string().optional()
    }).optional(),
}).passthrough();

export interface ISessionStore {
    get(key: string): Promise<unknown>;
    set(key: string, sessionData: unknown, maxAge?: number): Promise<void>;
    destroy(key: string): Promise<void>;
}

export class PrismaSessionStore implements ISessionStore {
    async get(sessionId: string): Promise<unknown> {
        const session = await usePrismaClient(async (prisma) => {
            return prisma.session.findUnique({
                where: { id: sessionId }
            });
        });

        if (!session) {
            return undefined;
        }

        // Check if session has expired (only if expiresAt is set)
        if (session.expiresAt && session.expiresAt < new Date()) {
            // Session expired, clean it up
            await usePrismaWrite(async (prisma) => {
                await prisma.session.delete({
                    where: { id: sessionId }
                });
            });
            return undefined;
        }

        return {
            passport: {
                user: session.userId
            }
        };
    }

    /**
     * Set session data
     * @param sessionId The session ID
     * @param sessionData The session data to store
     * @param maxAge Maximum age in milliseconds (optional for never-expiring sessions)
     */
    async set(sessionId: string, sessionData: unknown, maxAge?: number): Promise<void> {
        const parsedData = SessionDataSchema.parse(sessionData || {});

        // Only save to database if we have authentication data
        // koa-session calls this with just metadata before authentication
        if (!parsedData.passport?.user) {
            return;
        }

        const userId = parsedData.passport.user;

        // Calculate expiration date (null for never-expiring sessions)
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

    /**
     * Delete a session
     */
    async destroy(sessionId: string): Promise<void> {
        return usePrismaWrite(async (prisma) => {
            await prisma.session.delete({
                where: { id: sessionId }
            }).catch(() => {
                // Ignore errors if session doesn't exist
            });
        });
    }
}

const _store = new PrismaSessionStore();

/**
 * Worker-side implementation of {@link ISessionService}.
 */
export const sessionServiceCommands = {
    get: async ({ sessionId }: { sessionId: string }) =>
        _store.get(sessionId),
    set: async ({ sessionId, sessionData, maxAge }: { sessionId: string; sessionData: unknown; maxAge?: number }) =>
        _store.set(sessionId, sessionData, maxAge),
    destroy: async ({ sessionId }: { sessionId: string }) =>
        _store.destroy(sessionId),
} satisfies ISessionService;
