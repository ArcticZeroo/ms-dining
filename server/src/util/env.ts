export interface EnvironmentSettings {
    shouldFetchOnlyOneCafe: boolean;
    shouldFetchOnlyOneStation: boolean;
    skipDailyRepairIfMenuExists: boolean;
    skipWeeklyRepair: boolean;
    skipPatternRepair: boolean;
    maxConcurrentRequests?: number;
    maxConcurrentCafes: number;
    ignoreAnalyticsFailures?: boolean;
    logRequests: boolean;
    alwaysSlowUpdate: boolean;
}

export const isDev = process.env.NODE_ENV?.toLowerCase() === 'dev';

const DEFAULT_ENVIRONMENT_SETTINGS: Readonly<EnvironmentSettings> = {
    shouldFetchOnlyOneCafe:      false,
    shouldFetchOnlyOneStation:   false,
    skipDailyRepairIfMenuExists: false,
    skipWeeklyRepair:            false,
    skipPatternRepair:           false,
    maxConcurrentCafes:          10,
    logRequests:                 false,
    alwaysSlowUpdate:            false,
};

const DEV_ENVIRONMENT_SETTINGS: Partial<EnvironmentSettings> = {
    skipDailyRepairIfMenuExists: true,
    skipWeeklyRepair:            true,
    maxConcurrentRequests:       5,
    maxConcurrentCafes:          5,
    ignoreAnalyticsFailures:     true,
    alwaysSlowUpdate:            true,
};

const getEnvironmentSettings = (): Readonly<EnvironmentSettings> => {
    const overlay = isDev ? DEV_ENVIRONMENT_SETTINGS : {};
    return { ...DEFAULT_ENVIRONMENT_SETTINGS, ...overlay };
}

export const ENVIRONMENT_SETTINGS = getEnvironmentSettings();