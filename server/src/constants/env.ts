export const requireEnvironmentVariable = (key: string): string => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
}

export const hasEnvironmentVariable = (key: string): boolean => {
    return Boolean(process.env[key]);
}

export const WELL_KNOWN_ENVIRONMENT_VARIABLES = {
    openAi: 'OPENAI_API_KEY',
    devKey: 'DEV_KEY',
    sessionSecret: 'SESSION_SECRET',
    authMicrosoftClientId: 'AUTH_MICROSOFT_CLIENT_ID',
    authMicrosoftClientSecret: 'AUTH_MICROSOFT_CLIENT_SECRET',
    authMicrosoftCallbackUrl: 'AUTH_MICROSOFT_CALLBACK_URL',
    authGoogleClientId: 'AUTH_GOOGLE_CLIENT_ID',
    authGoogleClientSecret: 'AUTH_GOOGLE_CLIENT_SECRET',
    authGoogleCallbackUrl: 'AUTH_GOOGLE_CALLBACK_URL',
};

export const getOpenAiKey = () => requireEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.openAi);
export const getDevKey = () => requireEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.devKey);

export const getSessionSecret = () => requireEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.sessionSecret);

export const hasAuthEnvironmentVariables = () => {
    return hasEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.authMicrosoftClientId) &&
        hasEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.authMicrosoftClientSecret);
}