import { DateUtil } from '@msdining/common';
import fs from 'fs/promises';
import Semaphore from 'semaphore-async-await';
import { cafeList } from '../../../constants/cafes.js';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { ICafe } from '../../../models/cafe.js';
import { runPromiseWithRetries } from '../../../util/async.js';
import { isCafeAvailable } from '../../../util/date.js';
import { ENVIRONMENT_SETTINGS } from '../../../util/env.js';
import { logDebug, logError, logInfo } from '../../../util/log.js';
import { CafeStorageClient } from '../../storage/clients/cafe.js';
import { saveSessionAsync } from './storage.js';
import { DailyMenuStorageClient } from '../../storage/clients/daily-menu.js';
import { CafeMenuSession } from '../session/menu.js';
import { THUMBNAIL_WORKER_QUEUE } from '../../../worker/thumbnail.js';

export const cafeSemaphore = new Semaphore.default(ENVIRONMENT_SETTINGS.maxConcurrentCafes);
const cafeDiscoveryRetryDelayMs = 1000;

const dateStringsCurrentlyUpdatingByCafeId = new Map<string /*cafeId*/, Set<string /*dateString*/>>();

const retrieveUpdatingDateStringsForCafe = (cafe: ICafe) => {
    if (!dateStringsCurrentlyUpdatingByCafeId.has(cafe.id)) {
        dateStringsCurrentlyUpdatingByCafeId.set(cafe.id, new Set());
    }

    return dateStringsCurrentlyUpdatingByCafeId.get(cafe.id)!;
}

export const isCafeCurrentlyUpdating = (dateString: string, cafe: ICafe) => {
    return dateStringsCurrentlyUpdatingByCafeId.get(cafe.id)?.has(dateString) ?? false;
}

export const isAnyCafeCurrentlyUpdating = () => {
    return dateStringsCurrentlyUpdatingByCafeId.size > 0;
}

export class DailyCafeUpdateSession {
    public readonly cafeSessionsById = new Map<string, CafeMenuSession>();

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

    private async _doDiscoverCafeAsync(cafe: ICafe, attemptIndex: number) {
        try {
            await cafeSemaphore.acquire();

            logInfo(`{${this.dateString}} (${attemptIndex}) Discovering menu for "${cafe.name}" @ ${cafe.id}...`);

            const session = new CafeMenuSession(cafe);
            await session.initialize();
            const stations = await session.populateMenuAsync(this.daysInFuture);

            this.cafeSessionsById.set(cafe.id, session);

            return stations;
        } catch (err) {
            throw new Error(`Failed to discover menu for "${cafe.name}" @ ${cafe.id} (attempt ${attemptIndex}): ${err}`);
        } finally {
            cafeSemaphore.release();
        }
    }

    private async discoverCafeAsync(cafe: ICafe) {
        try {
            retrieveUpdatingDateStringsForCafe(cafe).add(this.dateString);

            await DailyMenuStorageClient.deleteDailyMenusAsync(this.dateString, cafe.id);

            const stations = await runPromiseWithRetries(
                (attemptIndex) => this._doDiscoverCafeAsync(cafe, attemptIndex),
                ENVIRONMENT_SETTINGS.cafeDiscoveryRetryCount,
                cafeDiscoveryRetryDelayMs
            );

            THUMBNAIL_WORKER_QUEUE.addFromMenu(stations);

            await saveSessionAsync({
                cafe,
                stations,
                dateString:                this.dateString,
                shouldUpdateExistingItems: true
            });
        } catch (err) {
            logError(`{${this.dateString}}`, `Failed to populate cafe ${cafe.name}:`, err);
        } finally {
            const updatingDateStrings = retrieveUpdatingDateStringsForCafe(cafe);

            updatingDateStrings.delete(this.dateString);

            if (updatingDateStrings.size === 0) {
                dateStringsCurrentlyUpdatingByCafeId.delete(cafe.id);
            }

            DailyMenuStorageClient.invalidateUniquenessData(cafe.id);
        }
    }

    public async populateAsync() {
        await this.resetDailyState();

        logInfo(`{${this.dateString}} Populating cafe sessions...`);
        const startTime = Date.now();

        const cafePromises: Array<Promise<unknown>> = [];

        for (const cafe of cafeList) {
            if (!isCafeAvailable(cafe, this.date)) {
                logDebug(`{${this.dateString}}`, `Skipping "${cafe.name}" @ ${cafe.id} because it is not available`);
                continue;
            }

            const discoverPromise = this.discoverCafeAsync(cafe);

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