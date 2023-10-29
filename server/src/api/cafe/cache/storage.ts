import { ICafe, ICafeStation } from '../../../models/cafe.js';
import { logError } from '../../../util/log.js';
import Semaphore from 'semaphore-async-await';
import { CafeStorageClient } from '../../storage/cafe.js';

// todo: make this more automatic by requiring everyone to call an async function get the prisma client
export const databaseLock = new Semaphore.Lock();

interface ISaveStationParams {
    cafe: ICafe;
    dateString: string;
    station: ICafeStation;
    shouldUpdateExistingItems: boolean;
}

const saveStationAsync = async ({ cafe, dateString, station, shouldUpdateExistingItems }: ISaveStationParams) => {
    try {
        await CafeStorageClient.createStationAsync(station, shouldUpdateExistingItems /*allowUpdateIfExisting*/);
    } catch (err) {
        logError('Unable to save station to database:', err);
        return;
    }

    for (const menuItem of station.menuItemsById.values()) {
        try {
            await CafeStorageClient.createMenuItemAsync(menuItem, shouldUpdateExistingItems /*allowUpdateIfExisting*/);
        } catch (err) {
            logError(`Unable to save menu item "${menuItem.name}"@${menuItem.id} to the database:`, err);
            // if we fail here, we will fail later when creating the daily menu
            return;
        }
    }

    try {
        await CafeStorageClient.createDailyStationMenuAsync({
            cafeId: cafe.id,
            station,
            dateString
        });
    } catch (err) {
        logError('Unable to save daily station menu to database:', err);
    }
}

interface ISaveSessionParams {
    cafe: ICafe;
    dateString: string;
    stations: ICafeStation[];
    shouldUpdateExistingItems: boolean;
}

export const saveSessionAsync = async ({
                                           cafe,
                                           dateString,
                                           stations,
                                           shouldUpdateExistingItems
                                       }: ISaveSessionParams) => {
    try {
        // Only let one "thread" write to the database at a time
        await databaseLock.acquire();

        // Only update existing items if we're looking at the menu for today
        for (const station of stations) {
            await saveStationAsync({
                station,
                cafe,
                dateString,
                shouldUpdateExistingItems
            });
        }
    } finally {
        databaseLock.release();
    }
}
