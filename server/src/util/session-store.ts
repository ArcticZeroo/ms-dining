import { usePrismaClient } from '../api/storage/client.js';
import { z } from 'zod';

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
        return usePrismaClient(async (prisma) => {
            const session = await prisma.session.findUnique({
                where: { id: sessionId }
            });

            if (!session) {
                return undefined;
            }

            // Check if session has expired (only if expiresAt is set)
            if (session.expiresAt && session.expiresAt < new Date()) {
                // Session expired, clean it up
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

        return usePrismaClient(async (prisma) => {
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
        return usePrismaClient(async (prisma) => {
            await prisma.session.delete({
                where: { id: sessionId }
            }).catch(() => {
                // Ignore errors if session doesn't exist
            });
        });
    }
}
