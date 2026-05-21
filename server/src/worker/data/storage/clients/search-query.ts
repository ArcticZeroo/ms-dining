import { usePrismaClient, usePrismaWrite } from '../client.js';
import type { ISearchQueryService, ITopSearchQuery } from '../../../../shared/services/search-query.js';

export abstract class SearchQueryClient {
    public static async incrementSearchCount(query: string): Promise<void> {
        query = query.trim().toLowerCase();

        await usePrismaWrite(prisma => prisma.searchQuery.upsert({
            where:  { query },
            update: { count: { increment: 1 } },
            create: { query, count: 1 }
        }));
    }

    public static async getTopSearchQueries(limit: number = 10): Promise<ITopSearchQuery[]> {
        const rows = await usePrismaClient(prisma => prisma.searchQuery.findMany({
            select:  { query: true, count: true },
            orderBy: { count: 'desc' },
            take:    limit,
        }));
        return rows;
    }
}

/**
 * Worker-side implementation of {@link ISearchQueryService}. Typed against
 * the shared interface so TypeScript enforces parity — adding a method to
 * the interface without implementing it here is a compile error.
 *
 * Registered with the data handler under the `searchQuery` service name.
 * In phase 2 this file moves to `src/worker-db/services/search-query.ts`.
 */
export const searchQueryServiceCommands = {
    incrementSearchCount: async ({ query }: { query: string }) =>
        SearchQueryClient.incrementSearchCount(query),
    getTopSearchQueries: async ({ limit }: { limit?: number }) =>
        SearchQueryClient.getTopSearchQueries(limit),
} satisfies ISearchQueryService;
