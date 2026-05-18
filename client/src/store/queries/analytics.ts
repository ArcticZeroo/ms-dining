import { useQuery } from '@tanstack/react-query';
import { AnalyticsClient } from '../../api/analytics.ts';
import { queryKeys } from './keys.ts';

export const useHourlyVisitsQuery = (daysAgo: number, scenarioName: string | undefined) =>
    useQuery({
        queryKey:        queryKeys.analytics.hourlyVisits(daysAgo, scenarioName),
        queryFn:         () => AnalyticsClient.retrieveHourlyVisitCountAsync(daysAgo, scenarioName),
        placeholderData: (previous) => previous,
    });
