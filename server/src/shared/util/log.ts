import { isDev } from './env.js';

const getDateLogString = () => {
    const now = new Date();
    return `[${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
};

export const logInfo = (...message: unknown[]) => {
    console.log(getDateLogString(), ...message);
}

export const logError = (...message: unknown[]) => {
    console.error(getDateLogString(), ...message);
}

const noop = () => {};

export const logDebug = isDev ? logInfo : noop;

export const getNamespaceLogger = (namespace: string) => ({
    info: (...message: unknown[]) => logInfo(`[${namespace}]`, ...message),
    error: (...message: unknown[]) => logError(`[${namespace}]`, ...message),
    debug: (...message: unknown[]) => logDebug(`[${namespace}]`, ...message)
});

export type Logger = ReturnType<typeof getNamespaceLogger>;