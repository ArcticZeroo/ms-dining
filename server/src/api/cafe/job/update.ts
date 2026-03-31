import { DateUtil } from '@msdining/common';
import fsp from 'fs/promises';
import { ALL_CAFES } from '../../../constants/cafes.js';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { ICafe } from '../../../models/cafe.js';
import { ICancellationToken, PromiseCancelledException, runPromiseWithRetries } from '../../../util/async.js';
import { isCafeAvailable } from '../../../util/date.js';
import { isCurrentlyPastMinutes, minutesToTimeString } from '@msdining/common/util/date-util';
import { ENVIRONMENT_SETTINGS } from '../../../util/env.js';
import { logDebug, logError, logInfo } from '../../../util/log.js';
import { Semaphore } from '../../lock/lock.js';
import { CafeStorageClient } from '../../storage/clients/cafe.js';
import { DailyMenuStorageClient } from '../../storage/clients/daily-menu.js';
import { saveDailyMenuAsync } from './storage.js';
import { CafeMenuSession } from '../session/menu.js';

export const cafeSemaphore = new Semaphore(ENVIRONMENT_SETTINGS.maxConcurrentCafes);
const cafeDiscoveryRetryDelayMs = 1000;

export class DailyCafeUpdateSession {
	#firstAttemptFailureCount = 0;
    readonly #cancellation: ICancellationToken;

    constructor(
        public readonly daysInFuture: number,
        cancellation?: ICancellationToken,
    ) {
        this.#cancellation = cancellation ?? { isCancelled: false };
    }

    get date() {
        return DateUtil.getNowWithDaysInFuture(this.daysInFuture);
    }

    get dateString() {
        return DateUtil.toDateString(this.date);
    }

    private async resetDailyState() {
        CafeStorageClient.resetCache();
        await fsp.mkdir(serverMenuItemThumbnailPath, { recursive: true });
    }

    async #discoverCafeAsync(cafe: ICafe, attemptIndex: number) {
        try {
            await cafeSemaphore.acquire();

            logInfo(`{${this.dateString}} (${attemptIndex}) Discovering menu for "${cafe.name}" @ ${cafe.id}...`);

            return await CafeMenuSession.retrieveMenuAsync(cafe, this.daysInFuture);
        } catch (err) {
			if (!(err instanceof PromiseCancelledException) && attemptIndex === 0) {
				this.#firstAttemptFailureCount++;

				if (this.#firstAttemptFailureCount >= ENVIRONMENT_SETTINGS.cafeMenuUpdateCircuitBreakerThreshold) {
					this.#cancellation.isCancelled = true;
					logError(`{${this.dateString}}`, `Cafe menu update breaker tripped: ${this.#firstAttemptFailureCount} cafe(s) have failed. Skipping remaining cafes.`);
				}
			}

            throw new Error(`Failed to discover menu for "${cafe.name}" @ ${cafe.id} (attempt ${attemptIndex}): ${err}`);
        } finally {
            cafeSemaphore.release();
        }
    }

    async #discoverCafeWithRetriesAsync(cafe: ICafe) {
        if (this.#cancellation.isCancelled) {
            logInfo(`{${this.dateString}}`, `Skipping "${cafe.name}" @ ${cafe.id} — too many cafes have failed update`);
            return;
        }

        try {
            const result = await runPromiseWithRetries(
                (attemptIndex) => this.#discoverCafeAsync(cafe, attemptIndex),
                ENVIRONMENT_SETTINGS.cafeDiscoveryRetryCount,
                cafeDiscoveryRetryDelayMs,
                this.#cancellation
            );

			if (this.#cancellation.isCancelled) {
				logInfo(`{${this.dateString}}`, `Skipping "${cafe.name}" @ ${cafe.id} after discovery because too many cafes have failed update`);
				return;
			}

            await DailyMenuStorageClient.upsertDailyCafeAsync(cafe.id, this.dateString, {
                isAvailable:     result.isAvailable,
                isShutDown:      result.isShutDown ?? false,
                shutDownMessage: result.shutDownMessage,
            });

            await saveDailyMenuAsync({
                cafe,
                stations:                  result.stations,
                isAvailable:               result.isAvailable,
                dateString:                this.dateString,
                shouldUpdateExistingItems: true
            });
        } catch (err) {
            if (err instanceof PromiseCancelledException) {
                return;
            }

            logError(`{${this.dateString}}`, `Failed to populate cafe ${cafe.name}:`, err);
        }
    }

    public async populateAsync(skipCafeIds: Set<string> = new Set()) {
        await this.resetDailyState();

        logInfo(`{${this.dateString}} Populating cafe sessions...`);
        const startTime = Date.now();

        const cafePromises: Array<Promise<unknown>> = [];

        for (const cafe of ALL_CAFES) {
            if (skipCafeIds.has(cafe.id)) {
                logDebug(`{${this.dateString}}`, `Skipping "${cafe.name}" @ ${cafe.id} because it is in the skip list`);
                continue;
            }

            if (!isCafeAvailable(cafe, this.date)) {
                logDebug(`{${this.dateString}}`, `Skipping "${cafe.name}" @ ${cafe.id} because it is not available`);
                continue;
            }

            // Skip cafes that are past their closing time for today
            if (this.daysInFuture === 0) {
                const storedHours = await DailyMenuStorageClient.getCafeHoursForDate(cafe.id, this.dateString);
                if (storedHours && isCurrentlyPastMinutes(storedHours.closesAt)) {
                    logInfo(`{${this.dateString}}`, `Skipping "${cafe.name}" @ ${cafe.id} because it is past closing time (closes at ${minutesToTimeString(storedHours.closesAt)}, opens at ${minutesToTimeString(storedHours.opensAt)})`);
                    continue;
                }
            }

            const discoverPromise = this.#discoverCafeWithRetriesAsync(cafe);

            cafePromises.push(discoverPromise);

            if (ENVIRONMENT_SETTINGS.shouldFetchOnlyOneCafe) {
                break;
            }
        }

        try {
            await Promise.all(cafePromises);
        } catch (err) {
            logError(`{${this.dateString}}`, '(should not be hit)', 'Failed to populate cafe sessions:', err);
        }

        const endTime = Date.now();
        const elapsedSeconds = (endTime - startTime) / 1000;

        logInfo(`{${this.dateString}} Finished populating cafe sessions in ${elapsedSeconds} second(s)`);
    }
}