import Semaphore from 'semaphore-async-await';
import { ICafe, ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { createAndSaveThumbnailForMenuItem } from '../image/thumbnail.js';
import { logDebug, logError, logInfo } from '../../../util/log.js';
import { CafeDiscoverySession } from '../session.js';

export const thumbnailSemaphore = new Semaphore.default(10);

const writeThumbnailForMenuItem = async (menuItem: IMenuItem) => {
    try {
        await thumbnailSemaphore.acquire();
        await createAndSaveThumbnailForMenuItem(menuItem);
        menuItem.hasThumbnail = true;
    } catch (e) {
        menuItem.hasThumbnail = false;
        logError('Failed to write thumbnail for menu item', menuItem.name, 'at URL', menuItem.imageUrl, 'with error:', e);
    } finally {
        thumbnailSemaphore.release();
    }
}

export const writeThumbnailsForCafe = async (cafe: ICafe, stations: ICafeStation[]) => {
    let count = 0;

    const thumbnailPromises = [];

    for (const station of stations) {
        for (const menuItem of station.menuItemsById.values()) {
            if (menuItem.imageUrl) {
                thumbnailPromises.push(writeThumbnailForMenuItem(menuItem));
                count++;
            }
        }
    }

    logDebug('Creating and writing', count, 'thumbnails for cafe', cafe.name);
    const startTime = Date.now();

    try {
        await Promise.all(thumbnailPromises);
    } catch (e) {
        logError('Failed to write thumbnails for cafe', cafe.name, 'with error:', e);
    }

    const endTime = Date.now();
    const elapsedSeconds = (endTime - startTime) / 1000;
    logDebug('Finished writing', count, 'thumbnails for cafe', cafe.name, 'in', elapsedSeconds.toFixed(2), 'second(s)');
}

