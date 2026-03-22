import { IMenuItemBase, IMenuItemReviewHeader } from '@msdining/common/models/cafe';
import { getReviewEntityKey, getReviewEntityKeyFromParts, ReviewStorageClient } from '../storage/clients/review.js';
import { StationStorageClient } from '../storage/clients/station.js';
import { CACHE_EVENTS, STORAGE_EVENTS } from '../storage/events.js';
import { LockedMap } from '../lock/map.js';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';

const MENU_ITEM_REVIEW_DATA_BY_ENTITY_KEY = new LockedMap<string /*entityKey*/, IMenuItemReviewHeader>();
const STATION_REVIEW_DATA_BY_ENTITY_KEY = new LockedMap<string /*entityKey*/, IMenuItemReviewHeader>();

const initialize = async () => {
    const [nameHeaders, groupHeaders, stationNameHeaders, stationGroupHeaders] = await Promise.all([
        ReviewStorageClient.getAllMenuItemReviewHeaders(),
        ReviewStorageClient.getAllMenuItemReviewHeadersByGroupId(),
        ReviewStorageClient.getAllStationReviewHeaders(),
        ReviewStorageClient.getAllStationReviewHeadersByGroupId()
    ]);

    const menuItemHeaders = [...nameHeaders, ...groupHeaders];
    const stationHeaders = [...stationNameHeaders, ...stationGroupHeaders];

    await Promise.all([
        ...menuItemHeaders.map(header => MENU_ITEM_REVIEW_DATA_BY_ENTITY_KEY.update(
            header.entityKey,
            () => ({ overallRating: header.overallRating, totalReviewCount: header.totalReviewCount })
        )),
        ...stationHeaders.map(header => STATION_REVIEW_DATA_BY_ENTITY_KEY.update(
            header.entityKey,
            () => ({ overallRating: header.overallRating, totalReviewCount: header.totalReviewCount })
        ))
    ]);
}

await initialize();

STORAGE_EVENTS.on('reviewDirty', (event) => {
    const entityKey = getReviewEntityKeyFromParts(event.groupId, event.normalizedName);
    const cache = event.stationId ? STATION_REVIEW_DATA_BY_ENTITY_KEY : MENU_ITEM_REVIEW_DATA_BY_ENTITY_KEY;
    cache.delete(entityKey)
        .then(() => {
            CACHE_EVENTS.emit('reviewDirty', event);
        })
        .catch(err => {
            console.error(`Failed to delete review header for "${entityKey}":`, err);
        });
});

STORAGE_EVENTS.on('groupMembershipDirty', (event) => {
    const deletions = [
        MENU_ITEM_REVIEW_DATA_BY_ENTITY_KEY.delete(`group:${event.groupId}`),
        STATION_REVIEW_DATA_BY_ENTITY_KEY.delete(`group:${event.groupId}`)
    ];
    for (const normalizedName of event.memberNormalizedNames) {
        deletions.push(MENU_ITEM_REVIEW_DATA_BY_ENTITY_KEY.delete(`name:${normalizedName}`));
        deletions.push(STATION_REVIEW_DATA_BY_ENTITY_KEY.delete(`name:${normalizedName}`));
    }
    Promise.all(deletions).catch(err => {
        console.error(`Failed to invalidate review headers for group "${event.groupId}":`, err);
    });
});

// --- Menu item review headers ---

const combineHeaders = (menuItemHeader: IMenuItemReviewHeader, stationHeader: IMenuItemReviewHeader): IMenuItemReviewHeader => {
    const totalReviewCount = menuItemHeader.totalReviewCount + stationHeader.totalReviewCount;
    if (totalReviewCount === 0) {
        return { totalReviewCount: 0, overallRating: 0 };
    }
    return {
        totalReviewCount,
        overallRating: (menuItemHeader.overallRating * menuItemHeader.totalReviewCount + stationHeader.overallRating * stationHeader.totalReviewCount) / totalReviewCount,
    };
};

const retrieveMenuItemOnlyReviewHeaderAsync = async (menuItem: IMenuItemBase): Promise<IMenuItemReviewHeader> => {
    const entityKey = getReviewEntityKey(menuItem);
    return MENU_ITEM_REVIEW_DATA_BY_ENTITY_KEY.update(
        entityKey,
        async (header) => {
            if (header != null) {
                return header;
            }
            if (menuItem.groupId) {
                return ReviewStorageClient.getReviewHeaderByGroupId(menuItem.groupId);
            }
            return ReviewStorageClient.getMenuItemReviewHeaderByName(normalizeNameForSearch(menuItem.name));
        });
}

const retrieveStationReviewHeaderForMenuItemAsync = async (stationId: string): Promise<IMenuItemReviewHeader> => {
    const station = await StationStorageClient.retrieveStationAsync(stationId);
    if (station == null) {
        return { totalReviewCount: 0, overallRating: 0 };
    }
    return retrieveStationReviewHeaderAsync({ name: station.name, groupId: station.groupId });
};

export const retrieveReviewHeaderAsync = async (menuItem: IMenuItemBase): Promise<IMenuItemReviewHeader> => {
    const [menuItemHeader, stationHeader] = await Promise.all([
        retrieveMenuItemOnlyReviewHeaderAsync(menuItem),
        retrieveStationReviewHeaderForMenuItemAsync(menuItem.stationId),
    ]);

    return combineHeaders(menuItemHeader, stationHeader);
}

export const retrieveReviewHeaderByPartsAsync = async (groupId: string | null | undefined, name: string): Promise<IMenuItemReviewHeader> => {
    const entityKey = getReviewEntityKeyFromParts(groupId, normalizeNameForSearch(name));

    return MENU_ITEM_REVIEW_DATA_BY_ENTITY_KEY.update(
        entityKey,
        async (header) => {
            if (header != null) {
                return header;
            }
            if (groupId) {
                return ReviewStorageClient.getReviewHeaderByGroupId(groupId);
            }
            return ReviewStorageClient.getMenuItemReviewHeaderByName(normalizeNameForSearch(name));
        });
}

// --- Station review headers ---

interface IStationEntity {
	name: string;
	groupId?: string | null;
}

export const retrieveStationReviewHeaderAsync = async (station: IStationEntity): Promise<IMenuItemReviewHeader> => {
    const entityKey = getReviewEntityKeyFromParts(station.groupId, normalizeNameForSearch(station.name));
    return STATION_REVIEW_DATA_BY_ENTITY_KEY.update(
        entityKey,
        async (header) => {
            if (header != null) {
                return header;
            }
            if (station.groupId) {
                return ReviewStorageClient.getStationReviewHeaderByGroupId(station.groupId);
            }
            return ReviewStorageClient.getStationReviewHeaderByName(normalizeNameForSearch(station.name));
        });
}

export const retrieveStationReviewHeaderByPartsAsync = async (groupId: string | null | undefined, name: string): Promise<IMenuItemReviewHeader> => {
    const entityKey = getReviewEntityKeyFromParts(groupId, normalizeNameForSearch(name));
    return STATION_REVIEW_DATA_BY_ENTITY_KEY.update(
        entityKey,
        async (header) => {
            if (header != null) {
                return header;
            }
            if (groupId) {
                return ReviewStorageClient.getStationReviewHeaderByGroupId(groupId);
            }
            return ReviewStorageClient.getStationReviewHeaderByName(normalizeNameForSearch(name));
        });
}

// Station weight factor for weighted score computation
const STATION_REVIEW_WEIGHT = 2;

export const retrieveWeightedStationReviewHeaderAsync = async (
    station: IStationEntity,
    menuItems: IMenuItemBase[]
): Promise<IMenuItemReviewHeader> => {
    const [stationHeader, ...itemHeaders] = await Promise.all([
        retrieveStationReviewHeaderAsync(station),
        ...menuItems.map(item => retrieveMenuItemOnlyReviewHeaderAsync(item))
    ]);

    const stationCount = stationHeader.totalReviewCount;
    const stationRatingSum = stationHeader.overallRating * stationCount;

    let itemCount = 0;
    let itemRatingSum = 0;
    for (const itemHeader of itemHeaders) {
        itemCount += itemHeader.totalReviewCount;
        itemRatingSum += itemHeader.overallRating * itemHeader.totalReviewCount;
    }

    const weightedTotal = stationCount * STATION_REVIEW_WEIGHT + itemCount;
    if (weightedTotal === 0) {
        return { totalReviewCount: 0, overallRating: 0 };
    }

    return {
        totalReviewCount: stationCount + itemCount,
        overallRating:    (stationRatingSum * STATION_REVIEW_WEIGHT + itemRatingSum) / weightedTotal,
    };
}