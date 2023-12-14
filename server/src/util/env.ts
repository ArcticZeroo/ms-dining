export interface EnvironmentSettings {
	shouldFetchOnlyOneCafe: boolean;
	shouldFetchOnlyOneStation: boolean;
	maxConcurrentRequests?: number;
}

export const isDev = process.env.NODE_ENV?.toLowerCase() === 'dev';

const devEnvironmentSettings: EnvironmentSettings = {
	shouldFetchOnlyOneCafe:    true,
	shouldFetchOnlyOneStation: true,
	maxConcurrentRequests:     5,
};

const prodEnvironmentSettings: EnvironmentSettings = {
	shouldFetchOnlyOneCafe:    false,
	shouldFetchOnlyOneStation: false
};

export const ENVIRONMENT_SETTINGS = isDev ? devEnvironmentSettings : prodEnvironmentSettings;