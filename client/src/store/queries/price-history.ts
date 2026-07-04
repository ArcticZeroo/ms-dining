import { useQuery } from '@tanstack/react-query';
import { PriceHistoryClient } from '../../api/price-history.ts';
import { queryKeys } from './keys.ts';

// The whole analysis is precomputed and small, so a single query loads every
// year-pair and the view selects between them client-side. Data changes at most
// once a day, so keep it fresh for a while to avoid refetch churn.
export const usePriceHistoryQuery = () =>
    useQuery({
        queryKey:  queryKeys.priceHistory.all,
        queryFn:   () => PriceHistoryClient.retrievePriceHistoryAsync(),
        staleTime: 1000 * 60 * 60,
    });
