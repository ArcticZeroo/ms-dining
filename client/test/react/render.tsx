import '@testing-library/jest-dom/vitest';
import React from 'react';
import { afterEach } from 'vitest';
import { cleanup, render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Registers once per importing (jsdom) test file — unmounts rendered trees
// between tests. Only *.dom.test.tsx files import this, so it never runs in the
// node environment.
afterEach(cleanup);

interface IProvidersWrapperProps {
    children: React.ReactNode;
}

const makeTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries:   { retry: false, gcTime: 0 },
        mutations: { retry: false },
    },
});

/**
 * Renders `element` wrapped in the providers most components need (currently a
 * fresh TanStack Query client). Add more providers here as component tests need.
 */
export const renderWithProviders = (element: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) => {
    const queryClient = makeTestQueryClient();

    const ProvidersWrapper: React.FC<IProvidersWrapperProps> = ({ children }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );

    return {
        queryClient,
        ...render(element, { wrapper: ProvidersWrapper, ...options }),
    };
};
