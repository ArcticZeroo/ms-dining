import { IMenuItem } from '../../../models/cafe.js';
import { MenuItem, MenuItemModifier, MenuItemModifierChoice, Prisma, PrismaClient } from '@prisma/client';
import { usePrismaClient } from '../client.js';
import { isUniqueConstraintFailedError } from '../../../util/prisma.js';
import { IMenuItemModifier, IMenuItemModifierChoice, ModifierChoiceType } from '@msdining/common/dist/models/cafe.js';
import { retrieveExistingThumbnailData } from '../../cafe/image/thumbnail.js';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { logDebug } from '../../../util/log.js';
import { ISearchTagQueueEntry } from '../../worker/search-tags.js';
import { fromDateString } from '@msdining/common/dist/util/date-util.js';
import Duration from '@arcticzeroo/duration';
import { Nullable } from '../../../models/util.js';

export abstract class MenuItemStorageClient {
    private static readonly _menuItemsById = new Map<string, IMenuItem>();

    public static resetCache() {
        this._menuItemsById.clear();
    }

    private static _doesExistingModifierMatchServer(existingModifier: MenuItemModifier, existingChoices: MenuItemModifierChoice[], serverModifier: IMenuItemModifier): boolean {
        return existingModifier.id === serverModifier.id
            && existingModifier.description === serverModifier.description
            && existingModifier.maximum === serverModifier.maximum
            && existingModifier.minimum === serverModifier.minimum
            && existingModifier.choiceType === serverModifier.choiceType
            && existingChoices.length === serverModifier.choices.length
            && existingChoices.every(existingChoice => {
                const serverChoice = serverModifier.choices.find(choice => choice.id === existingChoice.id);
                return serverChoice != null
                    && existingChoice.description === serverChoice.description
                    && existingChoice.price === serverChoice.price;
            });
    }

    private static async _doCreateModifierChoiceAsync(prismaClient: PrismaClient, modifier: IMenuItemModifier, choice: IMenuItemModifierChoice): Promise<void> {
        const existingChoice = await prismaClient.menuItemModifierChoice.findUnique({
            where: { id: choice.id }
        });

        if (existingChoice != null) {
            // some choices get disconnected from their modifiers somehow, so try to reconnect
            await prismaClient.menuItemModifierChoice.update({
                where: { id: choice.id },
                data:  {
                    description: choice.description,
                    price:       choice.price,
                    modifierId:  modifier.id
                }
            });
        } else {
            await prismaClient.menuItemModifierChoice.create({
                data: {
                    id:          choice.id,
                    description: choice.description,
                    price:       choice.price,
                    modifierId:  modifier.id
                }
            });
        }
    }

    private static async _doCreateSingleModifierAsync(prismaClient: PrismaClient, modifier: IMenuItemModifier): Promise<void> {
        const existingModifier = await prismaClient.menuItemModifier.findUnique({
            where:   { id: modifier.id },
            include: { choices: true }
        });

        if (existingModifier != null && this._doesExistingModifierMatchServer(existingModifier, existingModifier.choices, modifier)) {
            return;
        }

        await prismaClient.menuItemModifierChoice.deleteMany({
            where: {
                modifierId: modifier.id
            }
        });

        // TODO: figure out better typing. UpdateInput doesn't work well here.
        const dataWithoutId = {
            id:          modifier.id,
            description: modifier.description,
            minimum:     modifier.minimum,
            maximum:     modifier.maximum,
            // Maybe a bad idea?
            choiceType: modifier.choiceType as ModifierChoiceType
        };

        if (existingModifier != null) {
            await prismaClient.menuItemModifier.update({
                where: {
                    id: modifier.id,
                },
                data:  dataWithoutId
            });
        } else {
            await prismaClient.menuItemModifier.create({
                data: {
                    ...dataWithoutId,
                    id: modifier.id
                }
            });
        }

        for (const choice of modifier.choices) {
            await this._doCreateModifierChoiceAsync(prismaClient, modifier, choice);
        }
    }

    private static async _doSaveMenuItemAsync(menuItem: IMenuItem, allowUpdateIfExisting: boolean): Promise<void> {
        const lastUpdateTime = menuItem.lastUpdateTime == null || Number.isNaN(menuItem.lastUpdateTime.getTime())
            ? null
            : menuItem.lastUpdateTime;

        const dataWithoutId = {
            name:                   menuItem.name.trim(),
            normalizedName:         normalizeNameForSearch(menuItem.name),
            imageUrl:               menuItem.imageUrl || null,
            description:            menuItem.description?.trim() || null,
            price:                  Number(menuItem.price || 0),
            calories:               Number(menuItem.calories || 0),
            maxCalories:            Number(menuItem.maxCalories || 0),
            tags:                   menuItem.tags.length === 0 ? null : menuItem.tags.join(';'),
            externalLastUpdateTime: lastUpdateTime,
            externalReceiptText:    menuItem.receiptText || null,
            modifiers:              {
                connect: menuItem.modifiers.map(modifier => ({ id: modifier.id }))
            }
        } as const;

        const data = {
            id: menuItem.id,
            ...dataWithoutId
        };

        await usePrismaClient(async prismaClient => {
            // This is kind of messy, but I've chosen this after considering other options.
            // We are many:many, and we don't want to just clear all the modifiers themselves,
            // since that will either throw foreign key errors or sever the connection to other menu items
            // (depending on how we've set up cascade, which at the time of writing is not configured at all).
            // We also want to make sure that options are up-to-date for each modifier: the price, description,
            // or id can change at any time. So, we pull modifiers from db, check if there are any changes, then
            // clear all existing options and do an upsert.
            for (const modifier of menuItem.modifiers) {
                await this._doCreateSingleModifierAsync(prismaClient, modifier);
            }

            if (allowUpdateIfExisting) {
                const existingItem = await prismaClient.menuItem.findUnique({
                    where:  {
                        id: menuItem.id
                    },
                    select: {
                        modifiers: {
                            select: {
                                id: true
                            }
                        }
                    }
                });

                if (existingItem != null) {
                    // Menu items should have only a few modifiers, this complexity is fine.
                    const modifiersToRemove = existingItem.modifiers.filter(existingModifier => {
                        return menuItem.modifiers.every(modifier => modifier.id !== existingModifier.id);
                    });

                    await prismaClient.menuItem.update({
                        where: {
                            id: menuItem.id
                        },
                        data:  {
                            ...dataWithoutId,
                            modifiers: {
                                ...dataWithoutId.modifiers,
                                disconnect: modifiersToRemove.map(modifier => ({ id: modifier.id }))
                            }
                        }
                    });
                } else {
                    await prismaClient.menuItem.create({
                        data
                    });
                }
            } else {
                try {
                    await prismaClient.menuItem.create({
                        data
                    });
                } catch (err) {
                    // OK to fail unique constraint validation since we don't want to update existing items
                    if (!isUniqueConstraintFailedError(err)) {
                        throw err;
                    }
                }
            }
        });
    }

    public static async saveMenuItemAsync(menuItem: IMenuItem, allowUpdateIfExisting: boolean = false): Promise<void> {
        if (!allowUpdateIfExisting && MenuItemStorageClient._menuItemsById.has(menuItem.id)) {
            return;
        }

        await MenuItemStorageClient._doSaveMenuItemAsync(menuItem, allowUpdateIfExisting);

        // Require the operation to succeed before adding to cache
        this._menuItemsById.set(menuItem.id, menuItem);
    }

    public static async saveMenuItemSearchTagsAsync(menuItemId: string, searchTags: Set<string>): Promise<void> {
        await usePrismaClient(async prismaClient => {
            await prismaClient.menuItem.update({
                where: {
                    id: menuItemId
                },
                data:  {
                    searchTags: {
                        connectOrCreate: Array.from(searchTags).map(tag => ({
                            where:  { name: tag },
                            create: { name: tag }
                        }))
                    }
                }
            });
        });

        const localMenuItem = this._menuItemsById.get(menuItemId);
        if (localMenuItem != null) {
            localMenuItem.searchTags = searchTags;
        }
    }

    private static async _doRetrieveMenuItemAsync(id: string): Promise<IMenuItem | null> {
        const menuItem = await usePrismaClient(prismaClient => prismaClient.menuItem.findUnique({
            where:   { id },
            include: {
                modifiers:  {
                    include: {
                        choices: true
                    }
                },
                searchTags: {
                    select: {
                        name: true
                    }
                }
            }
        }));

        if (menuItem == null) {
            return null;
        }

        const thumbnailData = await retrieveExistingThumbnailData(id);

        const modifiers: IMenuItemModifier[] = [];
        for (const modifier of menuItem.modifiers) {
            modifiers.push({
                id:          modifier.id,
                description: modifier.description,
                minimum:     modifier.minimum,
                maximum:     modifier.maximum,
                // Maybe a bad idea?
                choiceType: modifier.choiceType as ModifierChoiceType,
                choices:    modifier.choices.map(choice => ({
                    id:          choice.id,
                    description: choice.description,
                    price:       choice.price
                }))
            });
        }

        return {
            id:              menuItem.id,
            name:            menuItem.name,
            description:     menuItem.description,
            price:           menuItem.price,
            calories:        menuItem.calories,
            maxCalories:     menuItem.maxCalories,
            imageUrl:        menuItem.imageUrl,
            lastUpdateTime:  menuItem.externalLastUpdateTime,
            receiptText:     menuItem.externalReceiptText,
            hasThumbnail:    thumbnailData.hasThumbnail,
            thumbnailHeight: thumbnailData.thumbnailHeight,
            thumbnailWidth:  thumbnailData.thumbnailWidth,
            tags:            menuItem.tags?.split(';') ?? [],
            searchTags:      new Set(menuItem.searchTags.map(tag => tag.name)),
            modifiers
        };
    }

    public static async retrieveMenuItemLocallyAsync(id: string): Promise<IMenuItem | null> {
        if (!this._menuItemsById.has(id)) {
            const menuItem = await this._doRetrieveMenuItemAsync(id);

            if (menuItem == null) {
                return null;
            }

            this._menuItemsById.set(id, menuItem);
        }

        return this._menuItemsById.get(id)!;
    }

    public static async batchNormalizeMenuItemNamesAsync(): Promise<void> {
        const now = Date.now();

        await usePrismaClient(async prismaClient => {
            const pendingItems = await prismaClient.menuItem.findMany({
                where: {
                    normalizedName: ''
                }
            });

            logDebug('Batch normalizing', pendingItems.length, 'menu item names');

            for (const item of pendingItems) {
                await prismaClient.menuItem.update({
                    where: { id: item.id },
                    data:  {
                        normalizedName: normalizeNameForSearch(item.name)
                    }
                });
            }
        });

        logDebug('Batch normalized menu item names in', Date.now() - now, 'ms');
    }

    public static async retrievePendingSearchTagQueueEntries(): Promise<Array<ISearchTagQueueEntry>> {
        const items = await usePrismaClient(prismaClient => prismaClient.menuItem.findMany({
            where:  {
                searchTags: {
                    none: {}
                },
            },
            select: {
                id:          true,
                name:        true,
                description: true
            }
        }));

        logDebug(`Found ${items.length} items for search tags`);

        const entries: ISearchTagQueueEntry[] = [];

        for (const potentialItem of items) {
            entries.push({
                id:          potentialItem.id,
                name:        potentialItem.name,
                description: potentialItem.description
            });
        }

        return entries;
    }

    public static async getExistingSearchTagsForName(name: string): Promise<Set<string>> {
        return usePrismaClient(async prismaClient => {
            const normalizedName = normalizeNameForSearch(name);

            const menuItem = await prismaClient.menuItem.findFirst({
                where: {
                    normalizedName,
                    searchTags: {
                        some: {}
                    }
                },
                select: {
                    searchTags: {
                        select: {
                            name: true
                        }
                    }
                }
            });

            if (menuItem == null) {
                return new Set();
            }

            return new Set(menuItem.searchTags.map(tag => tag.name));
        });
    }
}