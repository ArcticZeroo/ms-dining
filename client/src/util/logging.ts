import { DebugSettings } from '../constants/settings.ts';

export const verboseLog = (...args: unknown[]) => {
    if (DebugSettings.verboseLogging.value) {
        console.log(...args);
    }
}