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
} as const;
