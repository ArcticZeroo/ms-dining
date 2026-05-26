import { type Logger } from './log.js';

/**
 * Creates a debounced logger that batches entries over a time window
 * and logs a single summary line instead of one line per entry.
 *
 * - Single entry within the window: logs `"{prefix} {entry}"`
 * - Multiple entries: logs `"{prefix} {count} {pluralNoun}"`
 */
export const createDebouncedLogger = (
    logger: Logger,
    options: {
        prefix: string;
        pluralNoun: string;
        windowMs?: number;
    },
) => {
    const { prefix, pluralNoun, windowMs = 5_000 } = options;
    let pending: string[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;

    return (entry: string) => {
        pending.push(entry);
        if (timer != null) {
            return;
        }
        timer = setTimeout(() => {
            const entries = pending;
            pending = [];
            timer = null;
            if (entries.length === 1) {
                logger.info(`${prefix} ${entries[0]}`);
            } else {
                logger.info(`${prefix} ${entries.length} ${pluralNoun}`);
            }
        }, windowMs);
    };
};
