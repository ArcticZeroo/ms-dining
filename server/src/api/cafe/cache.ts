import { CafeDiscoverySession } from './session.js';
import cron from 'node-cron';
import { cafeList } from '../../constants/cafes.js';
import { logError, logInfo } from '../../util/log.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { serverMenuItemThumbnailPath } from '../../constants/config.js';
import { createAndSaveThumbnailForMenuItem } from './image/thumbnail.js';
import Semaphore from 'semaphore-async-await';
import { ICafe, IMenuItem } from '../../models/cafe.js';

export const cafeSessionsByUrl = new Map<string, CafeDiscoverySession>();

const resetState = async () => {
    cafeSessionsByUrl.clear();
    fsSync.rmSync(serverMenuItemThumbnailPath, { recursive: true, force: true });
    await fs.mkdir(serverMenuItemThumbnailPath, { recursive: true });
};

const cafeSemaphore = new Semaphore.default(5);
const thumbnailSemaphore = new Semaphore.default(10);

const writeThumbnailForMenuItem = async (menuItem: IMenuItem) => {
    try {
        await thumbnailSemaphore.acquire();
        await createAndSaveThumbnailForMenuItem(menuItem);
        menuItem.hasThumbnail = true;
    } catch (e) {
        menuItem.hasThumbnail = false;
        logError('Failed to write thumbnail for menu item', menuItem.displayName, 'at URL', menuItem.imageUrl, 'with error:', e);
    } finally {
        thumbnailSemaphore.release();
    }
}

const writeThumbnailsForCafe = async (session: CafeDiscoverySession) => {
    let count = 0;

    const thumbnailPromises = [];

    for (const station of session.stations) {
        for (const menuItem of station.menuItemsById.values()) {
            if (menuItem.imageUrl) {
                thumbnailPromises.push(writeThumbnailForMenuItem(menuItem));
                count++;
            }
        }
    }

    logInfo('Creating and writing', count, 'thumbnails for cafe', session.cafe.name);

    const startTime = Date.now();

    try {
        await Promise.all(thumbnailPromises);
    } catch (e) {
        logError('Failed to write thumbnails for cafe', session.cafe.name, 'with error:', e);
    }

    const endTime = Date.now();
    const elapsedSeconds = (endTime - startTime) / 1000;

    logInfo('Finished writing', count, 'thumbnails for cafe', session.cafe.name, 'in', elapsedSeconds.toFixed(2), 'second(s)');
}

const discoverCafeAsync = async (cafe: ICafe) => {
    const session = new CafeDiscoverySession(cafe);
    try {
        await cafeSemaphore.acquire();

        logInfo('Performing discovery for', cafe.name, 'at', cafe.url, '...');

        await session.performDiscoveryAsync();
        cafeSessionsByUrl.set(cafe.url, session);
    } catch (e) {
        logError(`Failed to populate cafe ${cafe.name} (${cafe.url})`, e);
    } finally {
        cafeSemaphore.release();
    }

    try {
        await writeThumbnailsForCafe(session);
    } catch (e) {
        logError('Unhandled error while populating thumbnails for cafe', cafe.name, 'with error:', e);
    }
}

const populateSessionsAsync = async () => {
    await resetState();

    logInfo('Populating cafe sessions...');
    const startTime = Date.now();

    const cafePromises: Array<Promise<unknown>> = [];

    for (const cafe of cafeList) {
        cafePromises.push(discoverCafeAsync(cafe));
    }

    await Promise.all(cafePromises);

    const endTime = Date.now();
    const elapsedSeconds = (endTime - startTime) / 1000;

    logInfo(`Finished populating cafe sessions in ${elapsedSeconds} second(s)`);
};

const populateSessions = () => {
    populateSessionsAsync()
        .catch(e => logError('Failed to populate cafe sessions', e));
};

// 9am on Monday through Friday
cron.schedule('0 9 * * 1,2,3,4,5', () => {
    populateSessions();
});

populateSessions();