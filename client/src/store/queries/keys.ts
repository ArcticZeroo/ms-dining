export const queryKeys = {
    app: {
        coreData: ['app', 'core-data'] as const,
    },
    cart: {
        hydration: ['cart', 'hydration'] as const,
    },
    ordering: {
        cartSession:        ['ordering', 'cart-session'] as const,
        cartEstimate:       (cafeId: string) => ['ordering', 'cart-estimate', cafeId] as const,
        orderHistorySummary: ['ordering', 'order-history-summary'] as const,
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
        mapResults:         (query: string) => ['search', 'map-results', query] as const,
        exploreResults:     (date: string, query: string) => ['search', 'explore-results', date, query] as const,
        visitHistory:       (entityType: string, name: string) => ['search', 'visit-history', entityType, name] as const,
    },
    cafe: {
        menu:                (cafeId: string, date: string) =>
            ['cafe', 'menu', cafeId, date] as const,
        overview:            (viewId: string, date: string) => ['cafe', 'overview', viewId, date] as const,
        overviewSummary:     (viewId: string, date: string) => ['cafe', 'overview-summary', viewId, date] as const,
    },
    analytics: {
        hourlyVisits: (daysAgo: number, scenarioName: string | undefined) =>
            ['analytics', 'hourly-visits', daysAgo, scenarioName ?? null] as const,
    },
} as const;
