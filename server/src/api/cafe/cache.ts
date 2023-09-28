import { CafeDiscoverySession } from './session.js';
import cron from 'node-cron';
import { cafeList } from '../../constants/cafes.js';
import { logError, logInfo } from '../../util/log.js';
import * as fs from 'fs/promises';
import { serverMenuItemThumbnailPath } from '../../constants/config.js';
import { createAndSaveThumbnailForMenuItem } from './image/thumbnail.js';
import { pause } from '../../util/async.js';

export const cafeSessionsByUrl = new Map<string, CafeDiscoverySession>();

const resetState = async () => {
    cafeSessionsByUrl.clear();
    await fs.rm(serverMenuItemThumbnailPath, { recursive: true, force: true });
    await fs.mkdir(serverMenuItemThumbnailPath, { recursive: true });
};

const generateThumbnailItems = function*() {
    for (const cafe of cafeList) {
        const session = cafeSessionsByUrl.get(cafe.url);

        if (!session) {
            console.error('Failed to find session for cafe', cafe.name);
            continue;
        }

        for (const station of session.stations) {
            for (const menuItem of station.menuItemsById.values()) {
                if (menuItem.imageUrl) {
                    yield menuItem;
                }
            }
        }
    }
}

const writeThumbnails = async () => {
    logInfo('Writing thumbnails...');

    for (const menuItem of generateThumbnailItems()) {
        await createAndSaveThumbnailForMenuItem(menuItem);
        await pause(10);
    }

    logInfo('Finished writing thumbnails');
}

const populateSessionsAsync = async () => {
    await resetState();

    logInfo('Populating cafe sessions...');

    for (const cafe of cafeList) {
        const session = new CafeDiscoverySession(cafe);
        try {
            logInfo('Performing discovery for', cafe.name, 'at', cafe.url, '...');
            await session.performDiscoveryAsync();
            cafeSessionsByUrl.set(cafe.url, session);
            break;
        } catch (e) {
            logError(`Failed to populate cafe ${cafe.name} (${cafe.url})`, e);
        }
    }

    await writeThumbnails();

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