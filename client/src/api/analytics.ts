import { IHourlyVisitCount } from "@msdining/common/dist/models/analytics";

export abstract class AnalyticsClient {
    public static async retrieveHourlyVisitCountAsync(days: number, scenario?: string): Promise<IHourlyVisitCount[]> {
        const response = await fetch(`/api/analytics/visits?days=${days}${scenario ? `&scenario=${scenario}` : ''}`);

        if (!response.ok) {
            throw new Error('Failed to get application visits');
        }

        return response.json();
    }
}