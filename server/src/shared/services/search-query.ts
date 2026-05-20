/**
 * Service interface for the SearchQuery aggregate (a record of how often each
 * normalized search-text query has been issued).
 *
 * Every method takes a single data-object argument (even when there's only
 * one field) so the interface matches the wire shape used by the handler's
 * nested-service dispatch — `sendRequest('searchQuery', 'method', data)`.
 * This means both the worker-side implementation and the main-side typed
 * client can be typed as `ISearchQueryService`, and TypeScript enforces that
 * they stay in sync. Adding a method to the interface breaks both sides at
 * compile time if they don't implement it.
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
     */
    incrementSearchCount(data: { query: string }): Promise<void>;

    /**
     * Return the most-issued search queries, descending by count. Default
     * limit matches the original storage-client default (10); the sitemap
     * generator passes a larger limit explicitly.
     */
    getTopSearchQueries(data: { limit?: number }): Promise<ITopSearchQuery[]>;
}
