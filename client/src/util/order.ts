import { formatTimeToHoursMinutes } from './date.js';

/**
 * Format a wait time range as a human-readable string.
 */
export const formatWaitTime = (minMinutes: number, maxMinutes: number): string => {
    if (minMinutes === maxMinutes) {
        return `${minMinutes} minute${minMinutes === 1 ? '' : 's'}`;
    }
    return `${minMinutes} - ${maxMinutes} minutes`;
};

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