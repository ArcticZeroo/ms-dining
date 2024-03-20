import { ICafe, ICafeStation } from '../../../models/cafe.js';
import { logError } from '../../../util/log.js';
import { StationStorageClient } from '../../storage/clients/station.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { DailyMenuStorageClient } from '../../storage/clients/daily-menu.js';

interface ISaveStationParams {
    cafe: ICafe;
    dateString: string;
    station: ICafeStation;
    shouldUpdateExistingItems: boolean;
}

const saveStationAsync = async ({ cafe, dateString, station, shouldUpdateExistingItems }: ISaveStationParams) => {
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

    try {
        await DailyMenuStorageClient.createDailyStationMenuAsync({
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
    // Only update existing items if we're looking at the menu for today
    for (const station of stations) {
        await saveStationAsync({
            station,
            cafe,
            dateString,
            shouldUpdateExistingItems
        });
    }
}
