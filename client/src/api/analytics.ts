import { IHourlyVisitCount } from '../models/analytics.ts';

export abstract class AnalyticsClient {
    public static async retrieveHourlyVisitCountAsync(days: number): Promise<IHourlyVisitCount[]> {
        const response = await fetch(`/api/analytics/visits?days=${days}`);
        if (!response.ok) {
            throw new Error('Failed to get application visits');
        }
        return response.json();
    }
}