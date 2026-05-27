import { type Logger } from './log.js';
import { clearTimeout } from 'node:timers';
import Duration from '@arcticzeroo/duration';

const DEBOUNCE_WINDOW_MS = new Duration({ seconds: 5 }).inMilliseconds;

interface ICafeDataLog {
    cafeId: string;
    dateString: string;
}

export const createDebouncedCafeDataLogger = (logger: Logger, baseMessage: string) => {
    const pendingCafeIdsByDateString = new Map<string /*dateString*/, Set<string /*cafeId*/>>();
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;

    return ({ cafeId, dateString }: ICafeDataLog) => {
        const cafeIdsForDateString = pendingCafeIdsByDateString.get(dateString) ?? new Set<string>();
        cafeIdsForDateString.add(cafeId);
        pendingCafeIdsByDateString.set(dateString, cafeIdsForDateString);

        clearTimeout(timer);
        timer = setTimeout(() => {
            const subMessages: string[] = [];
            for (const [dateString, cafeIds] of pendingCafeIdsByDateString.entries()) {
                subMessages.push(`${dateString}: ${Array.from(cafeIds).sort().join(', ')} (${cafeIds.size})`);
            }
            logger.info(`${baseMessage}:\n${subMessages.join('\n')}`);
            pendingCafeIdsByDateString.clear();
        }, DEBOUNCE_WINDOW_MS);
    };
};
