import { BuyOnDemandClient, DEFAULT_SCHEDULE_TIME, JSON_HEADERS } from './buy-ondemand-client.js';
import { ICafeStation } from '../../../models/cafe.js';
import { ICafeStationListItem } from '../../../models/buyondemand/responses.js';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import { DEFAULT_CLOSES_AT_MINUTES, DEFAULT_OPENS_AT_MINUTES, parseTimeToMinutes } from '@msdining/common/util/date-util';

const pickStationName = (stationJson: ICafeStationListItem, client: BuyOnDemandClient): string => {
	// onDemandDisplayText is the name shown on the on-demand web ordering site,
	// while displayText is for in-store kiosks and may contain promotional text
	// (e.g. "$0.54 Ice Cream Cone" instead of "Big Chicken").
	// Some station names are just a space, so fall back to the cafe name.
	const nameOptionsInOrder: Array<string | undefined> = [
		stationJson.conceptOptions?.onDemandDisplayText,
		stationJson.conceptOptions?.displayText,
		stationJson.name
	];

	for (const nameOption of nameOptionsInOrder) {
		const trimmedName = nameOption?.trim();
		if (trimmedName) {
			return trimmedName;
		}
	}

	return client.cafe.name;
}

const convertBuyOnDemandStation = (client: BuyOnDemandClient, stationJson: ICafeStationListItem): ICafeStation => {
    const url = stationJson.image
        ? new URL(stationJson.image, `https://${client.cafe.id}.buy-ondemand.com`)
        : undefined;

    const station: ICafeStation = {
        id:      stationJson.id,
        cafeId:  client.cafe.id,
        groupId: undefined,
		name:                      pickStationName(stationJson, client),
        logoUrl:                   url?.href,
        menuId:                    stationJson.priceLevelConfig.menuId,
        menuLastUpdateTime:        new Date(0),
        menuItemIdsByCategoryName: new Map(),
        menuItemsById:             new Map(),
        opensAt:                   stationJson.availableAt?.open ? (parseTimeToMinutes(stationJson.availableAt.open) ?? DEFAULT_OPENS_AT_MINUTES) : DEFAULT_OPENS_AT_MINUTES,
        closesAt:                  stationJson.availableAt?.close ? (parseTimeToMinutes(stationJson.availableAt.close) ?? DEFAULT_CLOSES_AT_MINUTES) : DEFAULT_CLOSES_AT_MINUTES,
    };

    const menu = stationJson.menus.find(menu => menu.id === station.menuId);

    if (menu == null) {
        throw new Error(`Unable to find menu with id ${station.menuId} in station ${station.name} (${station.id})`);
    }

    station.menuLastUpdateTime = new Date(menu.lastUpdateTime);

    const addItemsToCategory = (categoryName: string, itemsToAdd: string[]) => {
        const categoryItems = station.menuItemIdsByCategoryName.get(categoryName) ?? [];
        categoryItems.push(...itemsToAdd);
        station.menuItemIdsByCategoryName.set(categoryName, categoryItems);
    };

    for (const category of menu.categories) {
        if (category.items.length > 0) {
            addItemsToCategory(category.name, category.items);
        }

        // Some stations have subcategories, which we'll add as a separate category
        // e.g. "Sandwiches" + "Grilled" -> "Sandwiches - Grilled"
        // At the moment, we've only seen this in Beverages at Mila, where the
        // subcategory name was just a space, so in those cases we'll just append
        // to the parent category
        if (category.subCategories && category.subCategories.length > 0) {
            for (const subCategory of category.subCategories) {
                if (subCategory.items.length === 0) {
                    continue;
                }

                const subCategoryName = subCategory.name.trim();
                const targetName = subCategoryName ? `${category.name} - ${subCategoryName}` : category.name;
                addItemsToCategory(targetName, subCategory.items);
            }
        }
    }

    return station;
}

export interface IStationListResult {
    stations: Array<ICafeStation>;
    isAvailable: boolean;
    isShutDown?: boolean;
    shutDownMessage?: string;
}

export const retrieveStationListAsync = async (client: BuyOnDemandClient, daysInFuture: number): Promise<IStationListResult> => {
    const response = await client.requestAsync(
        `/sites/${client.config.tenantId}/${client.config.contextId}/concepts/${client.config.displayProfileId}`,
        {
            method:  'POST',
            headers: JSON_HEADERS,
            body:    JSON.stringify({
                scheduleTime: DEFAULT_SCHEDULE_TIME,
                scheduledDay: daysInFuture,
            }),
        },
        false /*shouldValidateSuccess*/
    );

    if (response.status === 410) {
        return { stations: [], isAvailable: false };
    }

    if (!response.ok) {
        throw new Error(`Unable to retrieve station list: ${response.status}`);
    }

    const json = await response.json();

    if (!isDuckTypeArray<ICafeStationListItem>(json, {
        id:    'string',
        name:  'string',
        menus: 'object'
    })) {
        throw new Error('Station list item is missing id/name/menus');
    }

    return {
        stations:    json.map(stationJson => convertBuyOnDemandStation(client, stationJson)),
        isAvailable: true,
    };
}