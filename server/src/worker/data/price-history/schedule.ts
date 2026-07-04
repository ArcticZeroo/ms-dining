import cron from 'node-cron';
import Duration from '@arcticzeroo/duration';
import { runWithDbPriority } from '../../../shared/util/db-priority.js';
import { logError, logInfo } from '../../../shared/util/log.js';
import { generatePriceHistoryAsync } from './generate.js';
import { readValidatedPriceHistoryAsync } from './read.js';

const STALE_THRESHOLD = new Duration({ days: 8 });

const runGenerationInBackground = () => {
    runWithDbPriority('background', () => {
        generatePriceHistoryAsync()
            .catch(error => logError('[price-history] scheduled generation failed:', error));
    });
};

/**
 * Registers the price-history regeneration schedule. No timezone is passed (as
 * with the daily/weekly crawl jobs it depends on) so cron runs in server-local
 * time. Regen happens in the morning, after the daily crawl (which starts at
 * 5am) has populated the new day so the new fiscal year has menu-presence.
 */
export const schedulePriceHistoryJob = () => {
    // Daily through the first half of July, at 9am — after the morning crawl.
    // Prices flip on July 1, so people want the new comparison that morning.
    // Running daily (not just July 1) shows it on the first weekday if July 1
    // lands on a weekend (the crawl skips weekends), and catches late
    // corrections over the following days.
    cron.schedule('0 9 1-14 7 *', runGenerationInBackground);

    // Weekly baseline the rest of the year (Saturday morning).
    cron.schedule('0 9 * * 6', runGenerationInBackground);
};

/**
 * On boot, regenerate if the cached blob is missing, older than the stale
 * threshold, or no longer matches the current schema (e.g. an old-shape blob
 * left behind by a previous deploy). Runs in the background at low db priority
 * so it never competes with the critical boot repairs or hammers BoD on every
 * restart.
 */
export const maybeGeneratePriceHistoryOnBootAsync = async () => {
    const existing = await readValidatedPriceHistoryAsync();

    if (existing == null) {
        logInfo('[price-history] Cached analysis missing or invalid, regenerating in background');
        runGenerationInBackground();
        return;
    }

    const isStale = existing.generatedAt == null
        || (Date.now() - new Date(existing.generatedAt).getTime()) > STALE_THRESHOLD.inMilliseconds;

    if (!isStale) {
        logInfo('[price-history] Cached analysis is fresh, skipping boot generation');
        return;
    }

    logInfo('[price-history] Cached analysis stale, regenerating in background');
    runGenerationInBackground();
};
