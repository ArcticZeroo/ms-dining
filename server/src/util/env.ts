export interface EnvironmentSettings {
    shouldFetchOnlyOneCafe: boolean;
    shouldFetchOnlyOneStation: boolean;
    skipDailyRepair: boolean;
    skipWeeklyRepair: boolean;
    maxConcurrentRequests?: number;
    maxConcurrentCafes: number;
    ignoreTrackingFailures?: boolean;
}

export const isDev = process.env.NODE_ENV?.toLowerCase() === 'dev';

const devEnvironmentSettings: EnvironmentSettings = {
    shouldFetchOnlyOneCafe:    false,
    shouldFetchOnlyOneStation: false,
    skipDailyRepair:           true,
    skipWeeklyRepair:          true,
    maxConcurrentRequests:     5,
    maxConcurrentCafes:        5,
    ignoreTrackingFailures:    true
};

const prodEnvironmentSettings: EnvironmentSettings = {
    shouldFetchOnlyOneCafe:    false,
    shouldFetchOnlyOneStation: false,
    skipDailyRepair:           false,
    skipWeeklyRepair:          false,
    maxConcurrentCafes:        10,
};

export const ENVIRONMENT_SETTINGS = isDev ? devEnvironmentSettings : prodEnvironmentSettings;