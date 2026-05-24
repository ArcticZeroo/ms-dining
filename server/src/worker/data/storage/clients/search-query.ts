import { usePrismaClient, usePrismaWrite } from '../client.js';
import type { ITopSearchQuery } from '../../../../shared/services/search-query.js';

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

