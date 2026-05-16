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
} as const;
