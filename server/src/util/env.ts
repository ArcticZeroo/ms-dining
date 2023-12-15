export interface EnvironmentSettings {
	shouldFetchOnlyOneCafe: boolean;
	shouldFetchOnlyOneStation: boolean;
	skipDailyRepair: boolean;
	maxConcurrentRequests?: number;
}

export const isDev = process.env.NODE_ENV?.toLowerCase() === 'dev';

const devEnvironmentSettings: EnvironmentSettings = {
	shouldFetchOnlyOneCafe:    true,
	shouldFetchOnlyOneStation: true,
	skipDailyRepair:           true,
	maxConcurrentRequests:     5,
};

const prodEnvironmentSettings: EnvironmentSettings = {
	shouldFetchOnlyOneCafe:    false,
	shouldFetchOnlyOneStation: false,
	skipDailyRepair:           false,
};

export const ENVIRONMENT_SETTINGS = isDev ? devEnvironmentSettings : prodEnvironmentSettings;