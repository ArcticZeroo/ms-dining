import Semaphore from 'semaphore-async-await';
import { toDateString } from '../../../util/date.js';
import fs from 'fs/promises';
import { serverMenuItemThumbnailPath } from '../../../constants/config.js';
import { ICafe, ICafeStation } from '../../../models/cafe.js';
import { CafeDiscoverySession } from '../session.js';
import { logError, logInfo } from '../../../util/log.js';
import { writeThumbnailsForCafe } from './thumbnail.js';
import { saveSessionAsync } from './storage.js';
import { cafeList } from '../../../constants/cafes.js';
import { CafeStorageClient } from '../../storage/cafe.js';

export const cafeSemaphore = new Semaphore.default(5);

export class DailyCafeUpdateSession {
    public readonly cafeSessionsById = new Map<string, CafeDiscoverySession>();

    constructor(public readonly daysInFuture: number) {
    }

    get date() {
        const date = new Date();
        date.setDate(date.getDate() + this.daysInFuture);
        return date;
    }

    get dateString() {
        return toDateString(this.date);
    }

    private async resetDailyState() {
        CafeStorageClient.resetCache();
        this.cafeSessionsById.clear();
        await Promise.all([
            fs.mkdir(serverMenuItemThumbnailPath, { recursive: true }),
            CafeStorageClient.deleteDailyMenusAsync(this.dateString)
        ]);
    };

    private async discoverCafeAsync(cafe: ICafe) {
        const session = new CafeDiscoverySession(cafe);
        let stations: ICafeStation[];
        try {
            await cafeSemaphore.acquire();

            logInfo('Performing discovery for', `"${cafe.name}@${cafe.id}"`, 'with', this.daysInFuture, 'day(s) in the future...');

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
            dateString: toDateString(new Date()),
            shouldUpdateExistingItems: true
        });
    }

    public async populateAsync() {
        await this.resetDailyState();

        logInfo('Populating cafe sessions...');
        const startTime = Date.now();

        const cafePromises: Array<Promise<unknown>> = [];

        for (const cafe of cafeList) {
            cafePromises.push(this.discoverCafeAsync(cafe));
            break;
        }

        await Promise.all(cafePromises);

        const endTime = Date.now();
        const elapsedSeconds = (endTime - startTime) / 1000;

        logInfo(`Finished populating cafe sessions in ${elapsedSeconds} second(s)`);
    };
}