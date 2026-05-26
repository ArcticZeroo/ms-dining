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
	requestRetryCount: number;
	cafeDiscoveryRetryCount: number;
	cafeMenuUpdateCircuitBreakerThreshold: number;
	/** Max concurrent in-flight calls allowed through `usePrismaClient`. */
	dbMaxConcurrency: number;
	/** When true, worker entry skips boot tasks (menu sync, embeddings, search tags). */
	skipBootTasks: boolean;
}

export const isDev = process.env.NODE_ENV?.toLowerCase() === 'dev';

/**
 * True when running inside node:test. node:test sets NODE_TEST_CONTEXT
 * in the environment for child processes spawned by the test runner.
 * We also set it explicitly in the test infrastructure for the main
 * process.
 */
export const isTestEnvironment = 'NODE_TEST_CONTEXT' in process.env;

const DEFAULT_ENVIRONMENT_SETTINGS: Readonly<EnvironmentSettings> = {
    shouldFetchOnlyOneCafe:                false,
    shouldFetchOnlyOneStation:             false,
    skipDailyRepairIfMenuExists:           false,
    skipWeeklyRepair:                      false,
    skipPatternRepair:                     false,
    maxConcurrentCafes:                    10,
    logRequests:                           false,
    requestRetryCount:                     3,
    cafeDiscoveryRetryCount:               3,
    cafeMenuUpdateCircuitBreakerThreshold: 4,
    dbMaxConcurrency:                      4,
    skipBootTasks:                         false,
};

const DEV_ENVIRONMENT_SETTINGS: Partial<EnvironmentSettings> = {
    shouldFetchOnlyOneCafe: true,
    // skipDailyRepairIfMenuExists: true,
    // skipWeeklyRepair:            true,
    maxConcurrentRequests:   5,
    maxConcurrentCafes:      1,
    ignoreAnalyticsFailures: true,
};

const TEST_ENVIRONMENT_SETTINGS: Partial<EnvironmentSettings> = {
    skipBootTasks:           true,
    ignoreAnalyticsFailures: true,
};

const getEnvironmentSettings = (): Readonly<EnvironmentSettings> => {
    const settings = { ...DEFAULT_ENVIRONMENT_SETTINGS };
    if (isTestEnvironment) {
        Object.assign(settings, TEST_ENVIRONMENT_SETTINGS);
    } else if (isDev) {
        Object.assign(settings, DEV_ENVIRONMENT_SETTINGS);
    }
    return settings;
}

export const ENVIRONMENT_SETTINGS = getEnvironmentSettings();