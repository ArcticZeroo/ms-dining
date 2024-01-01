import { CafeDiscoverySession, JSON_HEADERS } from './discovery.js';
import {
    ICafeMenuItemDetailsResponse,
    ICafeMenuItemListResponseItem,
    ICafeStationDetailsResponseItem,
    ICafeStationListItem
} from '../../../models/responses.js';
import { ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { isDuckTypeArray } from '@arcticzeroo/typeguard';
import { logError } from '../../../util/log.js';
import { normalizeTagName } from '../../../util/cafe.js';
import { TagStorageClient } from '../../storage/clients/tags.js';
import { MenuItemStorageClient } from '../../storage/clients/menu-item.js';
import { ENVIRONMENT_SETTINGS } from '../../../util/env.js';
import Semaphore from 'semaphore-async-await';
import { CafeTypes } from '@msdining/common';

type IMenuItemModifier = CafeTypes.IMenuItemModifier;
type ModifierChoiceType = CafeTypes.ModifierChoiceType;
const ModifierChoices = CafeTypes.ModifierChoices;

const tagLock = new Semaphore.Lock();

export class CafeMenuSession extends CafeDiscoverySession {
    #retrievedTagStationIds = new Set<string>();

    private _convertExternalStation(stationJson: ICafeStationListItem): ICafeStation {
        const station: ICafeStation = {
            id:                        stationJson.id,
            name:                      stationJson.name,
            logoUrl:                   stationJson.image,
            menuId:                    stationJson.priceLevelConfig.menuId,
            menuLastUpdateTime:        new Date(0),
            menuItemIdsByCategoryName: new Map(),
            menuItemsById:             new Map()
        };

        const menu = stationJson.menus.find(menu => menu.id === station.menuId);

        if (menu == null) {
            throw new Error(`Unable to find menu with id ${station.menuId} in station ${station.name} (${station.id})`);
        }

        station.menuLastUpdateTime = new Date(menu.lastUpdateTime);

        for (const category of menu.categories) {
            station.menuItemIdsByCategoryName.set(category.name, category.items);
        }

        return station;
    }

    private async retrieveStationListAsync(scheduledDay: number = 0): Promise<Array<ICafeStation>> {
        const response = await this._requestAsync(
            `/sites/${this.config.tenantId}/${this.config.contextId}/concepts/${this.config.displayProfileId}`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    isEasyMenuEnabled: false,
                    // TODO: use schedule time discovered in config?
                    scheduleTime: { startTime: '11:00 AM', endTime: '11:15 PM' },
                    scheduledDay: scheduledDay,
                    // storeInfo { some huge object }
                }),
            },
            false /*shouldValidateSuccess*/
        );

        if (response.status === 410) {
            // This cafe is not open today
            return [];
        }

        const json = await response.json();
        if (!isDuckTypeArray<ICafeStationListItem>(json, {
            id:    'string',
            name:  'string',
            menus: 'object'
        })) {
            throw new Error('Invalid object type');
        }

        return json.map(stationJson => this._convertExternalStation(stationJson));
    }

    private _mapModifierChoiceType(jsonChoiceType: string): ModifierChoiceType {
        switch (jsonChoiceType) {
            case 'radio':
                return ModifierChoices.radio;
            case 'checkbox':
                return ModifierChoices.checkbox;
            default:
                return ModifierChoices.multiSelect;
        }
    }

    private _mapModifiersFromDetails(jsonItem: ICafeMenuItemDetailsResponse): Array<IMenuItemModifier> {
        return jsonItem.modifiers.modifiers.map(jsonModifier => ({
            id:          jsonModifier.id,
            description: jsonModifier.description,
            minimum:     jsonModifier.minimum,
            maximum:     jsonModifier.maximum,
            choiceType:  this._mapModifierChoiceType(jsonModifier.type),
            choices:     jsonModifier.options.map(jsonOption => ({
                id:          jsonOption.id,
                description: jsonOption.description,
                price:       Number(jsonOption.amount || 0)
            }))
        }));
    }

    private async _requestModifierDetailsAsync(itemId: string): Promise<Array<IMenuItemModifier>> {
        const response = await this._requestAsync(`/sites/${this.config.tenantId}/${this.config.contextId}/kiosk-items/${itemId}`, {
            method: 'POST',
            body:   JSON.stringify({
                show86edModifiers: false,
                useIgPosApi:       false
            })
        });

        if (!response.ok) {
            throw new Error(`Unable to retrieve modifier details for item ${itemId}: ${response.status}`);
        }

        const json: ICafeMenuItemDetailsResponse = await response.json();

        if (json.modifiers?.modifiers == null) {
            return [];
        }

        return this._mapModifiersFromDetails(json);
    }

    private async _retrieveModifierDetailsAsync(localItem: IMenuItem | undefined, jsonItem: ICafeMenuItemListResponseItem): Promise<Array<IMenuItemModifier>> {
        if (!this._shouldRetrieveModifierDetails(localItem, jsonItem)) {
            return localItem?.modifiers ?? [];
        }

        try {
            return await this._requestModifierDetailsAsync(jsonItem.id);
        } catch (err) {
            logError(`Unable to retrieve modifier details for item ${jsonItem.id}:`, err);
            return [];
        }
    }

    private _isAnyModifierWeird(localItem: IMenuItem): boolean {
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

    private _shouldRetrieveModifierDetails(localItem: IMenuItem | undefined, jsonItem: ICafeMenuItemListResponseItem): boolean {
        // In case parsing is weird, don't treat null as a reason to skip retrieving
        if (jsonItem.isItemCustomizationEnabled === false) {
            return false;
        }

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

        return this._isAnyModifierWeird(localItem);
    }

    private async _requestTagDefinitionsAsync(stationId: string, menuId: string): Promise<Map<string, string>> {
        const response = await this._requestAsync(`/sites/${this.config.tenantId}/${this.config.contextId}/concepts/${this.config.displayProfileId}/menus/${stationId}`, {
            method:  'POST',
            headers: JSON_HEADERS,
            body:    JSON.stringify({
                menus:         [
                    {
                        id:         menuId,
                        categories: [
                            {
                                kioskImages: []
                            }
                        ]
                    }
                ],
                schedule:      [
                    {
                        // The service seems to try to find the first cron expression that starts before the schedule
                        // time, so we'll just have a cron expression that always matches
                        scheduledExpression: '0 0 0 * * *',
                        displayProfileState: {
                            conceptStates: [
                                {
                                    conceptId: stationId,
                                    menuId
                                }
                            ]
                        }
                    }
                ],
                scheduleTime:  {
                    startTime: '11:15 AM',
                    endTime:   '11:30 AM'
                },
                scheduledDay:  0,
                show86edItems: false,
                useIgPosApi:   false
            })
        });

        if (!response.ok) {
            throw new Error(`Unable to retrieve tags for station id ${stationId}: ${response.status}`);
        }

        const json = await response.json() as Array<ICafeStationDetailsResponseItem>;

        if (json.length !== 1) {
            throw new Error('Invalid number of stations in response!');
        }

        const station = json[0];
        return new Map(
            Object.values(station.customLabels)
                .map(labelData => [labelData.tagId, normalizeTagName(labelData.tagName)])
        );
    }

    private async _retrieveTagNameAsync(tagId: string, station: ICafeStation): Promise<string | undefined> {
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

            const externalTags = await this._requestTagDefinitionsAsync(station.id, station.menuId);

            await TagStorageClient.createTags(
                Array.from(externalTags.entries())
                    .map(([tagId, tagName]) => ({
                        id:   tagId,
                        name: tagName
                    }))
            );

            return externalTags.get(tagId);
        } catch (err) {
            logError(`Unable to retrieve tag name for tag id ${tagId} in station ${station.name} (${station.id}, ${station.menuId}):`, err);
            return undefined;
        } finally {
            tagLock.release();
        }
    }

    private async _convertExternalMenuItem(station: ICafeStation, localItemsById: Map<string, IMenuItem>, jsonItem: ICafeMenuItemListResponseItem): Promise<IMenuItem> {
        const localItem: IMenuItem | undefined = localItemsById.get(jsonItem.id);

        const modifiers = await this._retrieveModifierDetailsAsync(localItem, jsonItem);

        const tags = new Set<string>();
        if (jsonItem.tagIds != null) {
            for (const tagId of jsonItem.tagIds) {
                const tag = await this._retrieveTagNameAsync(tagId, station);
                if (tag != null) {
                    tags.add(tag);
                }
            }
        }

        return {
            id:             jsonItem.id,
            price:          Number(jsonItem.amount || 0),
            name:           jsonItem.displayText,
            calories:       Number(jsonItem.properties.calories || 0),
            maxCalories:    Number(jsonItem.properties.maxCalories || 0),
            hasThumbnail:   jsonItem.image != null,
            imageUrl:       jsonItem.image,
            description:    jsonItem.description,
            receiptText:    jsonItem.receiptText,
            lastUpdateTime: new Date(jsonItem.lastUpdateTime),
            tags:           Array.from(tags),
            modifiers,
        };
    }

    private async _requestMenuItemDetails(station: ICafeStation, localItemsById: Map<string, IMenuItem>, itemIds: string[]): Promise<Array<IMenuItem>> {
        const response = await this._requestAsync(`/sites/${this.config.tenantId}/${this.config.contextId}/kiosk-items/get-items`,
            {
                method:  'POST',
                headers: JSON_HEADERS,
                body:    JSON.stringify({
                    conceptId:          station.id,
                    currencyUnit:       'USD',
                    isCategoryHasItems: true,
                    itemIds,
                    menuPriceLevel:     {
                        menuId: station.menuId
                    },
                    show86edItems:      false,
                    useIgPosApi:        false
                })
            }
        );

        const json = await response.json();
        if (!isDuckTypeArray<ICafeMenuItemListResponseItem>(json, {
            id:          'string',
            amount:      'string',
            displayText: 'string',
            properties:  'object'
        })) {
            throw new Error('Invalid object type');
        }

        const items: IMenuItem[] = [];

        // Don't fail to retrieve the whole menu item because some failed
        const menuItemPromises = json.map(jsonItem => this._convertExternalMenuItem(station, localItemsById, jsonItem));
        for (const menuItemPromise of menuItemPromises) {
            try {
                items.push(await menuItemPromise);
            } catch (err) {
                logError('Unable to retrieve menu item:', err);
            }
        }

        return items;
    }

    private async retrieveMenuItemDetailsAsync(station: ICafeStation, itemIds: string[], alwaysGetServerItems: boolean): Promise<Array<IMenuItem>> {
        const itemIdsToRetrieve = new Set(itemIds);
        const items: IMenuItem[] = [];
        const localItemsById = new Map<string, IMenuItem>();

        const retrieveMenuItemDetailsLocallyAsync = async (itemId: string) => {
            const existingItem = await MenuItemStorageClient.retrieveMenuItemLocallyAsync(itemId);
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
            const serverItems = await this._requestMenuItemDetails(station, localItemsById, Array.from(itemIdsToRetrieve));

            for (const item of serverItems) {
                items.push(item);

                try {
                    await MenuItemStorageClient.createMenuItemAsync(item, true /*allowUpdateIfExisting*/);
                } catch (err) {
                    logError(`Unable to save menu item "${item.name}"@${item.id} to the database:`, err);
                }
            }
        }

        return items;
    }

    private async _populateMenuItemsForStationAsync(station: ICafeStation, alwaysGetServerItems: boolean) {
        const itemIds = Array.from(station.menuItemIdsByCategoryName.values()).flat();

        const menuItems = await this.retrieveMenuItemDetailsAsync(station, itemIds, alwaysGetServerItems);

        for (const menuItem of menuItems) {
            station.menuItemsById.set(menuItem.id, menuItem);
        }
    }

    private async populateMenuItemsForAllStationsAsync(stations: ICafeStation[], alwaysGetServerItems: boolean) {
        const populatePromises: Array<Promise<void>> = [];

        for (const station of stations) {
            populatePromises.push(this._populateMenuItemsForStationAsync(station, alwaysGetServerItems));

            if (ENVIRONMENT_SETTINGS.shouldFetchOnlyOneStation) {
                break;
            }
        }

        await Promise.all(populatePromises);
    }

    public async populateMenuAsync(scheduledDay: number = 0): Promise<Array<ICafeStation>> {
        const stations = await this.retrieveStationListAsync(scheduledDay);
        await this.populateMenuItemsForAllStationsAsync(stations, scheduledDay === 0 /*alwaysGetServerItems*/);
        return stations;
    }

}