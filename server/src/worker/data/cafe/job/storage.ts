import { ICafe, ICafeStation } from '../../../../shared/models/cafe.js';
import { StationStorageClient } from '../../storage/clients/station/station.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item/menu-item.js';
import { EMBEDDINGS_WORKER_QUEUE } from '../../../queues/embeddings.js';
import { SEARCH_TAG_WORKER_QUEUE } from '../../../queues/search-tags.js';
import { usePrismaTransaction } from '../../storage/client.js';
import { getServices } from '../../../../shared/services/registry.js';

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

    // Queue search tag generation only after menu items are persisted,
    // so the worker won't hit a missing MenuItem record.
    for (const station of stations) {
        for (const menuItem of station.menuItemsById.values()) {
            if (menuItem.searchTags.size === 0) {
                SEARCH_TAG_WORKER_QUEUE.add({
                    id:          menuItem.id,
                    name:        menuItem.name,
                    description: menuItem.description
                });
            }
        }
    }

    await getServices().data.dailyMenu.publishDailyStationMenuAsync({
        cafe,
        dateString,
        isAvailable,
        stations
    });
}
