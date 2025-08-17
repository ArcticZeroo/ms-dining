import { DateUtil } from '@msdining/common';
import fs from 'fs/promises';
import { ALL_CAFES } from '../../../constants/cafes.js';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { ICafe } from '../../../models/cafe.js';
import { runPromiseWithRetries } from '../../../util/async.js';
import { isCafeAvailable } from '../../../util/date.js';
import { ENVIRONMENT_SETTINGS } from '../../../util/env.js';
import { logDebug, logError, logInfo } from '../../../util/log.js';
import { Lock, Semaphore } from '../../lock.js';
import { CafeStorageClient } from '../../storage/clients/cafe.js';
import { saveDailyMenuAsync } from './storage.js';
import { CafeMenuSession } from '../session/menu.js';

export const cafeSemaphore = new Semaphore(ENVIRONMENT_SETTINGS.maxConcurrentCafes);
const cafeDiscoveryRetryDelayMs = 1000;

export class DailyCafeUpdateSession {
    constructor(public readonly daysInFuture: number) {
    }

    get date() {
        return DateUtil.getNowWithDaysInFuture(this.daysInFuture);
    }

    get dateString() {
        return DateUtil.toDateString(this.date);
    }

    private async resetDailyState() {
        CafeStorageClient.resetCache();
        await fs.mkdir(serverMenuItemThumbnailPath, { recursive: true });
    }

    async #discoverCafeAsync(cafe: ICafe, attemptIndex: number) {
        try {
            await cafeSemaphore.acquire();

            logInfo(`{${this.dateString}} (${attemptIndex}) Discovering menu for "${cafe.name}" @ ${cafe.id}...`);

            return await CafeMenuSession.retrieveMenuAsync(cafe, this.daysInFuture);
        } catch (err) {
            throw new Error(`Failed to discover menu for "${cafe.name}" @ ${cafe.id} (attempt ${attemptIndex}): ${err}`);
        } finally {
            cafeSemaphore.release();
        }
    }

    async #discoverCafeWithRetriesAsync(cafe: ICafe) {
        try {
            const stations = await runPromiseWithRetries(
                (attemptIndex) => this.#discoverCafeAsync(cafe, attemptIndex),
                ENVIRONMENT_SETTINGS.cafeDiscoveryRetryCount,
                cafeDiscoveryRetryDelayMs
            );

            await saveDailyMenuAsync({
                cafe,
                stations,
                dateString:                this.dateString,
                shouldUpdateExistingItems: true
            });
        } catch (err) {
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
    };
}