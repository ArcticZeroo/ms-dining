import { DateUtil } from '@msdining/common';
import fs from 'fs/promises';
import Semaphore from 'semaphore-async-await';
import { cafeList } from '../../../constants/cafes.js';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { ICafe } from '../../../models/cafe.js';
import { runPromiseWithRetries } from '../../../util/async.js';
import { isCafeAvailable } from '../../../util/date.js';
import { logError, logInfo } from '../../../util/log.js';
import { CafeStorageClient } from '../../storage/cafe.js';
import { CafeDiscoverySession } from '../session.js';
import { saveSessionAsync } from './storage.js';
import { writeThumbnailsForCafe } from './thumbnail.js';

export const cafeSemaphore = new Semaphore.default(5);
const cafeDiscoveryRetryCount = 3;
const cafeDiscoveryRetryDelayMs = 1000;

export class DailyCafeUpdateSession {
    public readonly cafeSessionsById = new Map<string, CafeDiscoverySession>();

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

            const session = new CafeDiscoverySession(cafe);
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
        await CafeStorageClient.deleteDailyMenusAsync(this.dateString, cafe.id);

        const stations = await runPromiseWithRetries(
            (attemptIndex) => this._doDiscoverCafeAsync(cafe, attemptIndex),
            cafeDiscoveryRetryCount,
            cafeDiscoveryRetryDelayMs
        );

        try {
            await writeThumbnailsForCafe(cafe, stations);
        } catch (e) {
            logError('Unhandled error while populating thumbnails for cafe', cafe.name, 'with error:', e);
        }

        await saveSessionAsync({
            cafe,
            stations,
            dateString: this.dateString,
            shouldUpdateExistingItems: true
        });
    }

    public async populateAsync(cafes: ICafe[] = cafeList) {
        await this.resetDailyState();

        logInfo(`{${this.dateString}} Populating cafe sessions...`);
        const startTime = Date.now();

        const cafePromises: Array<Promise<unknown>> = [];

        for (const cafe of cafes) {
            if (!isCafeAvailable(cafe, this.date)) {
                continue;
            }

            cafePromises.push(this.discoverCafeAsync(cafe));
        }

        try {
            await Promise.all(cafePromises);
        } catch (err) {
            logError(`{${this.dateString}}`, 'Failed to populate cafe sessions:', err);
        }

        const endTime = Date.now();
        const elapsedSeconds = (endTime - startTime) / 1000;

        logInfo(`{${this.dateString}} Finished populating cafe sessions in ${elapsedSeconds} second(s)`);
    };
}