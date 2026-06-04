import { QueryClient } from '@tanstack/react-query';
import { HttpException } from '../exception/http.js';

export const QUERY_CLIENT = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime:            5 * 60 * 1000,
            gcTime:               10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry:                (failureCount, error) => {
                if (error instanceof HttpException && [401, 403].includes(error.statusCode)) {
                    return false;
                }

                return failureCount < 3;
            },
            retryDelay:           (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
            networkMode:          'offlineFirst',
        },
    },
});
