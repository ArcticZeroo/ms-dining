import Semaphore from 'semaphore-async-await';
import { getNowWithDaysInFuture, toDateString } from '../../../util/date.js';
import fs from 'fs/promises';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { ICafe, ICafeStation } from '../../../models/cafe.js';
import { CafeDiscoverySession } from '../session.js';
import { logError, logInfo } from '../../../util/log.js';
import { writeThumbnailsForCafe } from './thumbnail.js';
import { saveSessionAsync } from './storage.js';
import { cafeList } from '../../../constants/cafes.js';
import { CafeStorageClient } from '../../storage/cafe.js';

export const cafeSemaphore = new Semaphore.default(3);

export class DailyCafeUpdateSession {
    public readonly cafeSessionsById = new Map<string, CafeDiscoverySession>();

    constructor(public readonly daysInFuture: number) {
    }

    get date() {
        return getNowWithDaysInFuture(this.daysInFuture);
    }

    get dateString() {
        return toDateString(this.date);
    }

    private async resetDailyState(cafes: ICafe[]) {
        CafeStorageClient.resetCache();
        await Promise.all([
            fs.mkdir(serverMenuItemThumbnailPath, { recursive: true }),
            CafeStorageClient.deleteDailyMenusAsync(this.dateString, cafes.map(cafe => cafe.id))
        ]);
    };

    private async discoverCafeAsync(cafe: ICafe) {
        const session = new CafeDiscoverySession(cafe);
        let stations: ICafeStation[];
        try {
            await cafeSemaphore.acquire();

            logInfo(`{${this.dateString}} Discovering menu for "${cafe.name}" @ ${cafe.id}...`);

            await session.initialize();
            stations = await session.populateMenuAsync(this.daysInFuture);
            this.cafeSessionsById.set(cafe.id, session);
        } catch (e) {
            logError(`Failed to populate cafe ${cafe.name} (${cafe.id})`, e);
            return;
        } finally {
            cafeSemaphore.release();
        }

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
        await this.resetDailyState(cafes);

        logInfo(`{${this.dateString}} Populating cafe sessions...`);
        const startTime = Date.now();

        const cafePromises: Array<Promise<unknown>> = [];

        for (const cafe of cafes) {
            cafePromises.push(this.discoverCafeAsync(cafe));
        }

        await Promise.all(cafePromises);

        const endTime = Date.now();
        const elapsedSeconds = (endTime - startTime) / 1000;

        logInfo(`{${this.dateString}} Finished populating cafe sessions in ${elapsedSeconds} second(s)`);
    };
}