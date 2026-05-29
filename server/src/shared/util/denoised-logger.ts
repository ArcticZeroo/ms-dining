import { type Logger } from './log.js';
import { clearTimeout } from 'node:timers';
import Duration from '@arcticzeroo/duration';

const LOG_INTERVAL_MS = new Duration({ seconds: 5 }).inMilliseconds;

interface ICafeDataLog {
    cafeId: string;
    dateString: string;
}

// There are a lot of scenarios that do an update to some piece of cafe-specific data for a particular date string.
// For example, syncing menus or pre-computing recommendations.
// It can be really noisy to show the updates for everything at once, so instead in these cases you should create
// a de-noised logger which only logs at max every {LOG_INTERVAL_MS} milliseconds.
export const createDenoisedCafeLogger = (logger: Logger, baseMessage: string) => {
    const pendingCafeIdsByDateString = new Map<string /*dateString*/, Set<string /*cafeId*/>>();
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;

    return ({ cafeId, dateString }: ICafeDataLog) => {
        const cafeIdsForDateString = pendingCafeIdsByDateString.get(dateString) ?? new Set<string>();
        cafeIdsForDateString.add(cafeId);
        pendingCafeIdsByDateString.set(dateString, cafeIdsForDateString);

        // Don't clear the timer if one exists - if updates happen every second forever, we should still report them on the regular interval.
        if (timer) {
            return;
        }

        timer = setTimeout(() => {
            const subMessages: string[] = [];

            // If there's only one entry, don't bother adding a newline before it. This is a hack to force the newline in a nice-ish way.
            if (pendingCafeIdsByDateString.size > 1) {
                subMessages.push('');
            }

            for (const [dateString, cafeIds] of pendingCafeIdsByDateString.entries()) {
                subMessages.push(`\t- ${dateString}: ${Array.from(cafeIds).sort().join(', ')} (${cafeIds.size})`);
            }

            logger.info(`${baseMessage}: ${subMessages.join('\n')}`);
            pendingCafeIdsByDateString.clear();
        }, LOG_INTERVAL_MS);
    };
};
