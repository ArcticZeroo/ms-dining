import { BuyOnDemandClient } from '../buy-ondemand/buy-ondemand-client.js';
import { ICafeMenuItemListResponseItem } from '../../../models/buyondemand/responses.js';
import { ICafe, ICafeStation, IMenuItemBase } from '../../../models/cafe.js';
import { logError } from '../../../util/log.js';
import { TagStorageClient } from '../../storage/clients/tags.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { ENVIRONMENT_SETTINGS } from '../../../util/env.js';
import { Lock } from 'semaphore-async-await';
import { SEARCH_TAG_WORKER_QUEUE } from '../../../worker/queues/search-tags.js';
import { retrieveStationListAsync } from '../buy-ondemand/stations.js';
import { retrieveTagDefinitionsAsync } from '../buy-ondemand/tags.js';
import { retrieveMenuItemsAsync } from '../buy-ondemand/menu-items.js';
import { retrieveModifiersForMenuItemAsync } from '../buy-ondemand/modifiers.js';
import { IMenuItemModifier } from '@msdining/common/models/cafe';

const tagLock = new Lock();

export class CafeMenuSession {
	#retrievedTagStationIds = new Set<string>();

	constructor(public readonly client: BuyOnDemandClient, public readonly daysInFuture: number) {
	}

	public static async retrieveMenuAsync(cafe: ICafe, daysInFuture: number = 0): Promise<Array<ICafeStation>> {
		const client = await BuyOnDemandClient.createAsync(cafe);
		const session = new CafeMenuSession(client, daysInFuture);
		return session.#retrieveMenuAsync();
	}

	async #retrieveModifierDetailsAsync(localItem: IMenuItemBase | undefined, jsonItem: ICafeMenuItemListResponseItem): Promise<Array<IMenuItemModifier>> {
		// In case parsing is weird, don't treat null as a reason to skip retrieving
		if (jsonItem.isItemCustomizationEnabled === false) {
			return [];
		}

		if (!this.#shouldRetrieveModifierDetails(localItem, jsonItem)) {
			return localItem?.modifiers ?? [];
		}

		try {
			return await retrieveModifiersForMenuItemAsync(this.client, jsonItem.id);
		} catch (err) {
			logError(`Unable to retrieve modifier details for item ${jsonItem.id}:`, err);
			return [];
		}
	}

	#isAnyModifierWeird(localItem: IMenuItemBase): boolean {
		return localItem.modifiers.some(modifier => {
			if (modifier.maximum === 0) {
				return true;
			}

			if (modifier.choices.length === 0) {
				return true;
			}

			if (modifier.maximum < modifier.minimum) {
				return true;
			}

			// Doesn't really make sense to allow a max of say, 5 choices, but only give the user 4 options to choose from
			if (modifier.choices.length < modifier.maximum) {
				return true;
			}

			return false;
		});
	}

	#shouldRetrieveModifierDetails(localItem: IMenuItemBase | undefined, jsonItem: ICafeMenuItemListResponseItem): boolean {
		if (localItem == null || localItem.lastUpdateTime == null || Number.isNaN(localItem.lastUpdateTime.getTime())) {
			return true;
		}

		const externalLastUpdateTime = new Date(jsonItem.lastUpdateTime);
		if (Number.isNaN(externalLastUpdateTime.getTime())) {
			return true;
		}

		if (externalLastUpdateTime.getTime() > localItem.lastUpdateTime.getTime()) {
			return true;
		}

		// Just in case we missed modifiers previously...
		if (localItem.modifiers.length === 0) {
			return true;
		}

		return this.#isAnyModifierWeird(localItem);
	}

	async #retrieveTagNameAsync(tagId: string, station: ICafeStation): Promise<string | undefined> {
		try {
			// This might be a bottleneck, but we don't want to drop tags
			await tagLock.acquire();

			const localTags = await TagStorageClient.retrieveTagsAsync();

			if (localTags.has(tagId)) {
				return localTags.get(tagId);
			}

			// Only reach out once per station
			if (this.#retrievedTagStationIds.has(station.id)) {
				return undefined;
			}

			this.#retrievedTagStationIds.add(station.id);

			const buyOnDemandTags = await retrieveTagDefinitionsAsync({
				client:       this.client,
				daysInFuture: this.daysInFuture,
				stationId:    station.id,
				menuId:       station.menuId
			});

			await TagStorageClient.createTags(
				Array.from(buyOnDemandTags.entries())
					.map(([tagId, tagName]) => ({
						id:   tagId,
						name: tagName
					}))
			);

			return buyOnDemandTags.get(tagId);
		} catch (err) {
			logError(`Unable to retrieve tag name for tag id ${tagId} in station ${station.name} (${station.id}, ${station.menuId}):`, err);
			return undefined;
		} finally {
			tagLock.release();
		}
	}

	async #convertBuyOnDemandMenuItem(station: ICafeStation, localItemsById: Map<string, IMenuItemBase>, jsonItem: ICafeMenuItemListResponseItem): Promise<IMenuItemBase> {
		const localItem: IMenuItemBase | undefined = localItemsById.get(jsonItem.id);

		const modifiers = await this.#retrieveModifierDetailsAsync(localItem, jsonItem);

		const tags = new Set<string>();
		if (jsonItem.tagIds != null) {
			for (const tagId of jsonItem.tagIds) {
				const tag = await this.#retrieveTagNameAsync(tagId, station);
				if (tag != null) {
					tags.add(tag);
				}
			}
		}

		const imageUrl = jsonItem.image
			? new URL(jsonItem.image, `https://${this.client.cafe.id}.buy-ondemand.com`)
			: undefined;

		// Don't use localItem for properties that are native to the buy-ondemand
		// API, consider buy-ondemand to be the source of truth so if something
		// is missing then we should clear it from the local item as well.
		return {
			id:             jsonItem.id,
			groupId:        localItem?.groupId,
			cafeId:         this.client.cafe.id,
			stationId:      station.id,
			price:          Number(jsonItem.amount || 0),
			name:           jsonItem.displayText,
			calories:       Number(jsonItem.properties.calories || 0),
			maxCalories:    Number(jsonItem.properties.maxCalories || 0),
			hasThumbnail:   false,
			imageUrl:       imageUrl?.href,
			description:    jsonItem.description,
			receiptText:    jsonItem.receiptText,
			lastUpdateTime: new Date(jsonItem.lastUpdateTime),
			tags:           new Set(tags),
			searchTags:     localItem?.searchTags ?? new Set<string>(),
			modifiers,
		};
	}

	async #retrieveMenuItemsFromBuyOnDemandAsync(station: ICafeStation, localItemsById: Map<string, IMenuItemBase>, itemIds: string[]): Promise<Array<IMenuItemBase>> {
		const json = await retrieveMenuItemsAsync(this.client, station, itemIds);

		const items: IMenuItemBase[] = [];

		// Don't fail to retrieve the whole menu item because some failed
		const menuItemPromises = json.map(jsonItem => this.#convertBuyOnDemandMenuItem(station, localItemsById, jsonItem));
		for (const menuItemPromise of menuItemPromises) {
			try {
				items.push(await menuItemPromise);
			} catch (err) {
				logError('Unable to retrieve menu item:', err);
			}
		}

		return items;
	}

	async #retrieveMenuItemsAsync(station: ICafeStation, itemIds: string[], alwaysGetServerItems: boolean): Promise<Array<IMenuItemBase>> {
		const itemIdsToRetrieve = new Set(itemIds);
		const items: IMenuItemBase[] = [];
		const localItemsById = new Map<string, IMenuItemBase>();

		const retrieveMenuItemDetailsLocallyAsync = async (itemId: string) => {
			const existingItem = await MenuItemStorageClient.retrieveMenuItemAsync(itemId);
			if (existingItem == null) {
				return;
			}

			localItemsById.set(itemId, existingItem);

			if (!alwaysGetServerItems) {
				itemIdsToRetrieve.delete(itemId);
				items.push(existingItem);
			}
		};

		await Promise.all(itemIds.map(retrieveMenuItemDetailsLocallyAsync));

		// Side note: if we send a request with an empty list, we get EVERY item
		if (itemIdsToRetrieve.size > 0) {
			const serverItems = await this.#retrieveMenuItemsFromBuyOnDemandAsync(station, localItemsById, Array.from(itemIdsToRetrieve));

			for (const item of serverItems) {
				// we save menu items at the end of the process now
				// try {
				// 	await MenuItemStorageClient.saveMenuItemAsync(item, true /*allowUpdateIfExisting*/);
				// } catch (err) {
				// 	logError(`Unable to save menu item "${item.name}"@${item.id} to the database:`, err);
				// 	continue;
				// }

				items.push(item);

				if (item.searchTags.size === 0) {
					SEARCH_TAG_WORKER_QUEUE.add({
						id:          item.id,
						name:        item.name,
						description: item.description
					});
				}
			}
		}

		return items;
	}

	async #populateMenuItemsForStationAsync(station: ICafeStation, alwaysGetServerItems: boolean) {
		const itemIds = Array.from(station.menuItemIdsByCategoryName.values()).flat();

		const menuItems = await this.#retrieveMenuItemsAsync(station, itemIds, alwaysGetServerItems);

		for (const menuItem of menuItems) {
			station.menuItemsById.set(menuItem.id, menuItem);
		}

		// Some items are in the list of items by category but the server doesn't return them, which means they aren't actually on the menu.
		for (const [categoryName, possibleItemIds] of station.menuItemIdsByCategoryName.entries()) {
			const actualItemIds = possibleItemIds.filter(itemId => station.menuItemsById.has(itemId));

			// if there are no items there today, get rid of the category entirely
			if (actualItemIds.length === 0) {
				station.menuItemIdsByCategoryName.delete(categoryName);
			} else {
				station.menuItemIdsByCategoryName.set(categoryName, actualItemIds);
			}
		}
	}

	async #populateMenuItemsForAllStationsAsync(stations: ICafeStation[], alwaysGetServerItems: boolean) {
		const populatePromises: Array<Promise<void>> = [];

		for (const station of stations) {
			populatePromises.push(this.#populateMenuItemsForStationAsync(station, alwaysGetServerItems));

			if (ENVIRONMENT_SETTINGS.shouldFetchOnlyOneStation) {
				break;
			}
		}

		await Promise.all(populatePromises);
	}

	async #retrieveMenuAsync(): Promise<Array<ICafeStation>> {
		const stations = await retrieveStationListAsync(this.client, this.daysInFuture);
		await this.#populateMenuItemsForAllStationsAsync(stations, this.daysInFuture === 0 /*alwaysGetServerItems*/);
		return stations;
	}

}