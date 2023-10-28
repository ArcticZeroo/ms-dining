import { CafeDiscoverySession } from './session.js';
import cron from 'node-cron';
import { cafeList } from '../../constants/cafes.js';
import { logError, logInfo } from '../../util/log.js';
import * as fs from 'fs/promises';
import { serverMenuItemThumbnailPath } from '../../constants/config.js';
import { createAndSaveThumbnailForMenuItem } from './image/thumbnail.js';
import Semaphore from 'semaphore-async-await';
import { ICafe, ICafeStation, IMenuItem } from '../../models/cafe.js';
import * as cafeStorage from '../storage/cafe.js';
import { toDateString } from '../../util/date.js';

export const cafeSessionsByUrl = new Map<string, CafeDiscoverySession>();

const resetDailyState = async () => {
    cafeSessionsByUrl.clear();
    await Promise.all([
        fs.mkdir(serverMenuItemThumbnailPath, { recursive: true }),
        cafeStorage.deleteDailyMenusAsync(toDateString(new Date()))
    ]);
};

const cafeSemaphore = new Semaphore.default(5);
const thumbnailSemaphore = new Semaphore.default(10);
const databaseLock = new Semaphore.Lock();

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

const saveStationAsync = async (session: CafeDiscoverySession, station: ICafeStation, shouldUpdateExistingItems: boolean) => {
    let dailyStationId: number;
    try {
        await cafeStorage.createStationAsync(station, shouldUpdateExistingItems /*allowUpdateIfExisting*/);
        const dailyStation = await cafeStorage.createDailyStationAsync({
            cafeId:     session.cafe.id,
            stationId:  station.id,
            dateString: session.dateString
        });
        dailyStationId = dailyStation.id;
    } catch (err) {
        logError('Unable to save station to database:', err);
        return;
    }

    for (const menuItem of station.menuItemsById.values()) {
        try {
            await cafeStorage.createMenuItemAsync(menuItem, shouldUpdateExistingItems /*allowUpdateIfExisting*/);
            await cafeStorage.createDailyMenuItemAsync(dailyStationId, menuItem.id);
        } catch (err) {
            logError('Unable to save menu item to database:', err);
            return;
        }
    }
}

const saveSessionAsync = async (session: CafeDiscoverySession) => {
    // Only update existing items if we're looking at the menu for today
    const shouldUpdateExistingItems = session.scheduledDay === 0;
    for (const station of session.stations) {
        await saveStationAsync(session, station, shouldUpdateExistingItems);
    }
}

const discoverCafeAsync = async (cafe: ICafe) => {
    const session = new CafeDiscoverySession({ cafe, scheduledDay: 0 });
    try {
        await cafeSemaphore.acquire();

        logInfo('Performing discovery for', cafe.name, 'at', cafe.id, '...');

        await session.performDiscoveryAsync();
        cafeSessionsByUrl.set(cafe.id, session);
    } catch (e) {
        logError(`Failed to populate cafe ${cafe.name} (${cafe.id})`, e);
    } finally {
        cafeSemaphore.release();
    }

    try {
        await writeThumbnailsForCafe(session);
    } catch (e) {
        logError('Unhandled error while populating thumbnails for cafe', cafe.name, 'with error:', e);
    }

    try {
        // Only let one "thread" write to the database at a time
        await databaseLock.acquire();
        await saveSessionAsync(session);
    } finally {
        databaseLock.release();
    }
}

const populateDailySessionsAsync = async () => {
    await resetDailyState();

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

const populateDailySessions = () => {
    populateDailySessionsAsync()
        .catch(e => logError('Failed to populate cafe sessions', e));
};

// 3am on Monday through Friday
cron.schedule('0 3 * * 1,2,3,4,5', () => {
    populateDailySessions();
});

populateDailySessions();