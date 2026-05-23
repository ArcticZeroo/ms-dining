import { formatTimeToHoursMinutes } from './date.js';

/**
 * Compute estimated ready time from a completion time + wait time range.
 */
export const getEstimatedReadyTime = (
    completedAt: Date,
    waitTimeMin: number,
    waitTimeMax: number,
): { earliest: Date; latest: Date } => ({
    earliest: new Date(completedAt.getTime() + waitTimeMin * 60_000),
    latest:   new Date(completedAt.getTime() + waitTimeMax * 60_000),
});

/**
 * Format estimated ready time as a human-readable string.
 */
export const formatEstimatedReadyTime = (
    completedAt: Date,
    waitTimeMin: number,
    waitTimeMax: number,
): string => {
    const { earliest, latest } = getEstimatedReadyTime(completedAt, waitTimeMin, waitTimeMax);

    if (earliest.getTime() === latest.getTime()) {
        return formatTimeToHoursMinutes(earliest);
    }

    return `${formatTimeToHoursMinutes(earliest)} - ${formatTimeToHoursMinutes(latest)}`;
};