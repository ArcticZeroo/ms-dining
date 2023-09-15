import { IHourlyVisitCount } from '../models/analytics.ts';

export abstract class AnalyticsClient {
    private static _padTimeValue(value: number): string {
        return value.toString().padStart(2, '0');
    }

    public static getDateString(date: Date): string {
        return `${date.getUTCFullYear()}-${AnalyticsClient._padTimeValue(date.getUTCMonth() + 1)}-${AnalyticsClient._padTimeValue(date.getUTCDate())}T${AnalyticsClient._padTimeValue(date.getUTCHours())}:${AnalyticsClient._padTimeValue(date.getUTCMinutes())}`;
    }

    public static async retrieveHourlyVisitCountAsync(after: string): Promise<IHourlyVisitCount[]> {
        const response = await fetch(`/api/analytics/visits?after=${after}`);
        if (!response.ok) {
            throw new Error('Failed to get application visits');
        }
        return response.json();
    }
}