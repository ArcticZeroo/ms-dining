export interface EnvironmentSettings {
    shouldFetchOnlyOneCafe: boolean;
    shouldFetchOnlyOneStation: boolean;
    skipDailyRepairIfMenuExists: boolean;
    skipWeeklyRepair: boolean;
    maxConcurrentRequests?: number;
    maxConcurrentCafes: number;
    ignoreTrackingFailures?: boolean;
    logRequests: boolean;
}

export const isDev = process.env.NODE_ENV?.toLowerCase() === 'dev';

const defaultEnvironmentSettings: Readonly<EnvironmentSettings> = {
    shouldFetchOnlyOneCafe:      false,
    shouldFetchOnlyOneStation:   false,
    skipDailyRepairIfMenuExists: false,
    skipWeeklyRepair:            false,
    maxConcurrentCafes:          10,
    logRequests:                 false
};

const devEnvironmentSettings: Partial<EnvironmentSettings> = {
    skipDailyRepairIfMenuExists: true,
    skipWeeklyRepair:            true,
    maxConcurrentRequests:       5,
    maxConcurrentCafes:          5,
    ignoreTrackingFailures:      true
};

const getEnvironmentSettings = (): Readonly<EnvironmentSettings> => {
    const overlay = isDev ? devEnvironmentSettings : {};
    return { ...defaultEnvironmentSettings, ...overlay };
}

export const ENVIRONMENT_SETTINGS = getEnvironmentSettings();