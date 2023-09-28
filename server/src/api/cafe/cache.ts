import { CafeDiscoverySession } from './session.js';
import cron from 'node-cron';
import { cafeList } from '../../constants/cafes.js';
import { logError, logInfo } from '../../util/log.js';
import * as fs from 'fs/promises';
import { serverMenuItemThumbnailPath } from '../../constants/config.js';
import { createAndSaveThumbnailForMenuItem } from './image/thumbnail.js';
import Semaphore from 'semaphore-async-await';
import { IMenuItem } from '../../models/cafe.js';

export const cafeSessionsByUrl = new Map<string, CafeDiscoverySession>();

const resetState = async () => {
    cafeSessionsByUrl.clear();
    await fs.rm(serverMenuItemThumbnailPath, { recursive: true, force: true });
    await fs.mkdir(serverMenuItemThumbnailPath, { recursive: true });
};

// This is really stupid, but whatever.
const thumbnailSemaphore = new Semaphore.default(10);

const writeThumbnailForMenuItem = async (menuItem: IMenuItem) => {
    try {
        await thumbnailSemaphore.acquire();
        await createAndSaveThumbnailForMenuItem(menuItem);
    } catch (e) {
        logError('Failed to write thumbnail for menu item', menuItem.id, 'at URL', menuItem.imageUrl, 'with error:', e);
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

    logInfo('Writing', count, 'thumbnails for cafe', session.cafe.name);

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

const populateSessionsAsync = async () => {
    await resetState();

    logInfo('Populating cafe sessions...');

    const thumbnailPromises = [];

    for (const cafe of cafeList) {
        const session = new CafeDiscoverySession(cafe);
        try {
            logInfo('Performing discovery for', cafe.name, 'at', cafe.url, '...');

            await session.performDiscoveryAsync();
            cafeSessionsByUrl.set(cafe.url, session);

            thumbnailPromises.push(writeThumbnailsForCafe(session));
        } catch (e) {
            logError(`Failed to populate cafe ${cafe.name} (${cafe.url})`, e);
        }
    }

    await Promise.all(thumbnailPromises);

    logInfo('Finished populating cafe sessions');
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