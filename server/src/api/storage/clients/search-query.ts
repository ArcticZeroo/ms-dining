import { usePrismaClient } from '../client.js';

export abstract class SearchQueryClient {
	public static async incrementSearchCount(query: string) {
		query = query.trim().toLowerCase();

		return usePrismaClient(prisma => prisma.searchQuery.upsert({
			where:  { query },
			update: { count: { increment: 1 } },
			create: { query, count: 1 }
		}));
	}

	public static async getTopSearchQueries(limit: number = 10) {
		return usePrismaClient(prisma => prisma.searchQuery.findMany({
			orderBy: { count: 'desc' },
			take: limit
		}));
	}
}