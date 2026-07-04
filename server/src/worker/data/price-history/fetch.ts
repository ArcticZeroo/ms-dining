import { ALL_CAFES } from '../../../shared/constants/cafes.js';
import { ICafe } from '../../../shared/models/cafe.js';
import { createBuyOnDemandClient } from '../../../shared/services/registry.js';
import { logError } from '../../../shared/util/log.js';
import { retrieveMenuItemsAsync } from '../cafe/buy-ondemand/menu-items.js';
import { retrieveStationListAsync } from '../cafe/buy-ondemand/stations.js';
import { parsePriceLevels } from './parse.js';

// Cap how many cafes we hit BoD for at once. Requests are already throttled per
// client, but this keeps the background job from bursting every cafe together.
const CAFE_CONCURRENCY = 4;

export interface IItemPriceLevels {
    menuItemId: string;
    name: string;
    cafeId: string;
    amountByFiscalYear: Map<number, number>;
}

const retrieveCafePriceLevelsAsync = async (cafe: ICafe): Promise<IItemPriceLevels[]> => {
    const client = await createBuyOnDemandClient(cafe);
    const { stations } = await retrieveStationListAsync(client, 0);

    const items: IItemPriceLevels[] = [];

    for (const station of stations) {
        const itemIds = Array.from(new Set(Array.from(station.menuItemIdsByCategoryName.values()).flat()));
        if (itemIds.length === 0) {
            continue;
        }

        const serverItems = await retrieveMenuItemsAsync(client, station, itemIds);
        for (const serverItem of serverItems) {
            const amountByFiscalYear = parsePriceLevels(serverItem);
            if (amountByFiscalYear.size === 0) {
                continue;
            }

            items.push({
                menuItemId: serverItem.id,
                name:       serverItem.displayText,
                cafeId:     cafe.id,
                amountByFiscalYear,
            });
        }
    }

    return items;
};

/**
 * Fetches the live price-level map for every currently-available item across
 * all cafes. Only currently-available items are returned (BoD only exposes
 * live items), which is exactly what the July-1 "what changed" view needs.
 */
export const fetchAllCafePriceLevelsAsync = async (): Promise<IItemPriceLevels[]> => {
    const queue = [...ALL_CAFES];
    const allItems: IItemPriceLevels[] = [];

    const runWorker = async (): Promise<void> => {
        for (let cafe = queue.shift(); cafe != null; cafe = queue.shift()) {
            try {
                const cafeItems = await retrieveCafePriceLevelsAsync(cafe);
                allItems.push(...cafeItems);
            } catch (error) {
                logError(`[price-history] Failed to fetch price levels for ${cafe.id}:`, error);
            }
        }
    };

    await Promise.all(Array.from({ length: CAFE_CONCURRENCY }, runWorker));

    return allItems;
};
