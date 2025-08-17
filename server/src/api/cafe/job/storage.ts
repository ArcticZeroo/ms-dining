import { ICafe, ICafeStation } from '../../../models/cafe.js';
import { logError } from '../../../util/log.js';
import { StationStorageClient } from '../../storage/clients/station.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { DailyMenuStorageClient } from '../../storage/clients/daily-menu.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../../../worker/queues/embeddings.js';

interface ISaveStationParams {
    cafe: ICafe;
    dateString: string;
    station: ICafeStation;
    shouldUpdateExistingItems: boolean;
}

// Saves only the "static" data for a station (including menu items), but not the daily menu itself.
const saveStaticStationDataAsync = async ({ cafe, dateString, station, shouldUpdateExistingItems }: ISaveStationParams) => {
    try {
        await StationStorageClient.createStationAsync(station, shouldUpdateExistingItems /*allowUpdateIfExisting*/);
    } catch (err) {
        logError('Unable to save station to database:', err);
        return;
    }

    for (const menuItem of station.menuItemsById.values()) {
        try {
            await MenuItemStorageClient.saveMenuItemAsync(menuItem, shouldUpdateExistingItems /*allowUpdateIfExisting*/);
        } catch (err) {
            logError(`Unable to save menu item "${menuItem.name}" @ ${menuItem.id} to the database:`, err);
            // if we fail here, we will fail later when creating the daily menu
            return;
        }
    }
}

interface ISaveSessionParams {
    cafe: ICafe;
    dateString: string;
    stations: ICafeStation[];
    shouldUpdateExistingItems: boolean;
}

export const saveDailyMenuAsync = async ({
                                           cafe,
                                           dateString,
                                           stations,
                                           shouldUpdateExistingItems
                                       }: ISaveSessionParams) => {
    EMBEDDINGS_WORKER_QUEUE.addFromMenu(stations);

    // Only update existing items if we're looking at the menu for today
    for (const station of stations) {
        await saveStaticStationDataAsync({
            station,
            cafe,
            dateString,
            shouldUpdateExistingItems
        });
    }

    await DailyMenuStorageClient.publishDailyStationMenuAsync({
        cafe,
        dateString,
        stations
    });
}
