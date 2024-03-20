const getEnvironmentVariable = (key: string): string => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
}

export const getChatGptKey = () => getEnvironmentVariable('OPENAI_API_KEY');