const requireEnvironmentVariable = (key: string): string => {
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
    openAi: 'OPENAI_API_KEY'
};

export const getOpenAiKey = () => requireEnvironmentVariable(WELL_KNOWN_ENVIRONMENT_VARIABLES.openAi);