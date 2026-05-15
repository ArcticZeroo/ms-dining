import { ICafe, ICafeStation } from '../../../models/cafe.js';
import { StationStorageClient } from '../../storage/clients/station.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { DailyMenuStorageClient } from '../../storage/clients/daily-menu.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../../../worker/queues/embeddings.js';
import { usePrismaTransaction } from '../../storage/client.js';

interface ISaveStationParams {
    station: ICafeStation;
    shouldUpdateExistingItems: boolean;
}

// Saves only the "static" data for a station (including menu items), but not the daily menu itself.
// Station + all menu items are saved in a single transaction to minimize
// SQLite write-lock contention and avoid socket timeouts under concurrency.
const saveStaticStationDataAsync = async ({ station, shouldUpdateExistingItems }: ISaveStationParams) => {
    await usePrismaTransaction(async (client) => {
        await StationStorageClient.createStationWithClientAsync(client, station, shouldUpdateExistingItems /*allowUpdateIfExisting*/);

        for (const menuItem of station.menuItemsById.values()) {
            await MenuItemStorageClient.saveMenuItemWithClientAsync(client, menuItem, shouldUpdateExistingItems /*allowUpdateIfExisting*/);
        }
    });
}

interface ISaveSessionParams {
    cafe: ICafe;
    dateString: string;
    isAvailable: boolean;
    stations: ICafeStation[];
    shouldUpdateExistingItems: boolean;
}

export const saveDailyMenuAsync = async ({
    cafe,
    dateString,
    isAvailable,
    stations,
    shouldUpdateExistingItems
}: ISaveSessionParams) => {
    EMBEDDINGS_WORKER_QUEUE.addFromMenu(stations, dateString);

    for (const station of stations) {
        await saveStaticStationDataAsync({
            station,
            shouldUpdateExistingItems
        });
    }

    await DailyMenuStorageClient.publishDailyStationMenuAsync({
        cafe,
        dateString,
        isAvailable,
        stations
    });
}
