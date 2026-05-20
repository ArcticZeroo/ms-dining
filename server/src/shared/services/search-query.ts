/**
 * Service interface for the SearchQuery aggregate (a record of how often each
 * normalized search-text query has been issued).
 *
 * Implemented twice:
 *  - Worker-side: `searchQueryServiceCommands` in
 *    `src/api/storage/clients/search-query.ts` (phase 1; moves to worker-db/ in phase 2).
 *  - Main-side: `searchQueryService` in `src/main/services/data/search-query.ts`,
 *    a thin client that forwards calls through the data handler.
 *
 * Both implementations satisfy this interface so the main-side client gives
 * full type safety without coupling main code to the worker-side internals.
 *
 * Lives in `src/shared/` because both sides — main (which implements the
 * client) and worker-db (which implements the service) — need to know about
 * it, and `shared/` is the only directory both are allowed to import from.
 */
export interface ITopSearchQuery {
    query: string;
    count: number;
}

export interface ISearchQueryService {
    /**
     * Bump the count for the given query (creating the row if missing). Query
     * text is trimmed and lowercased before storage so subsequent reads see
     * canonical-form keys.
     *
     * Fire-and-forget at call sites: callers don't await this on the request
     * path. Return is a Promise so the data-handler transport can resolve
     * cleanly, but the resolved value is not currently consumed.
     */
    incrementSearchCount(query: string): Promise<void>;

    /**
     * Return the most-issued search queries, descending by count. Default
     * limit matches the original storage-client default (10); the sitemap
     * generator passes a larger limit explicitly.
     */
    getTopSearchQueries(limit?: number): Promise<ITopSearchQuery[]>;
}
