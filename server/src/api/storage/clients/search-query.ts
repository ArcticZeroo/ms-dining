import { usePrismaClient, usePrismaWrite } from '../client.js';
import type { ISearchQueryService, ITopSearchQuery } from '../../../shared/services/search-query.js';

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
 * Worker-side command map for {@link ISearchQueryService}. Registered with
 * the data handler under the `searchQuery` service name. Each entry is a
 * single-arg function as required by the handler's nested-service shape;
 * methods that take multiple parameters on the interface wrap them into an
 * object payload here.
 *
 * In phase 2 this file moves to `src/worker-db/services/search-query.ts`
 * and the storage-client implementation moves with it. The shape registered
 * here does not change between phase 1 and phase 2.
 */
export const searchQueryServiceCommands = {
    incrementSearchCount: (data: { query: string }) =>
        SearchQueryClient.incrementSearchCount(data.query),
    getTopSearchQueries: (data: { limit?: number }) =>
        SearchQueryClient.getTopSearchQueries(data.limit),
} as const;
