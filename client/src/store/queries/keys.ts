export const queryKeys = {
    cart: {
        hydration: ['cart', 'hydration'] as const,
    },
    ordering: {
        cartSession: ['ordering', 'cart-session'] as const,
    },
} as const;
