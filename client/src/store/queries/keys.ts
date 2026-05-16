export const queryKeys = {
    cart: {
        hydration: ['cart', 'hydration'] as const,
    },
    ordering: {
        cartSession: ['ordering', 'cart-session'] as const,
    },
    groups: {
        list:              ['groups', 'list'] as const,
        zeroContext:       ['groups', 'zero-context'] as const,
        itemsWithoutGroup: ['groups', 'items-without-group'] as const,
    },
    reviews: {
        // [...summary, entityId] for per-entity summaries.
        summary:    ['reviews', 'summary'] as const,
        recent:     ['reviews', 'recent'] as const,
        mine:       ['reviews', 'mine'] as const,
        entityById: (entityId: string) => ['reviews', 'summary', entityId] as const,
    },
    search: {
        cheapItems:         (date: string) => ['search', 'cheap-items', date] as const,
        autocomplete:       (query: string) => ['search', 'autocomplete', query] as const,
        recommendedQueries: (query: string) => ['search', 'recommended-queries', query] as const,
        favorites:          (date: string, queryHashes: string[]) => ['search', 'favorites', date, queryHashes] as const,
        recommendations:    (date: string) => ['search', 'recommendations', date] as const,
        results:            (date: string, query: string) => ['search', 'results', date, query] as const,
    },
} as const;
