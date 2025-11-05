import { IMenuItemModifier, IMenuItemModifierChoice, ModifierChoiceType } from '@msdining/common/models/cafe';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import {
	MenuItem,
	MenuItemModifier,
	MenuItemModifierChoice,
	MenuItemModifierEntry,
	PrismaClient
} from '@prisma/client';
import { IMenuItemBase } from '../../../models/cafe.js';
import { deserializeMenuItemTags, serializeMenuItemTags } from '../../../util/cafe.js';
import { logDebug, logInfo } from '../../../util/log.js';
import { isUniqueConstraintFailedError } from '../../../util/prisma.js';
import { ISearchTagQueueEntry } from '../../../worker/queues/search-tags.js';
import { usePrismaClient, usePrismaTransaction } from '../client.js';
import { getDateStringsForWeek } from '@msdining/common/util/date-util';
import { menuItemToGroupMember } from './groups.js';
import { PrismaLikeClient } from '../../../models/prisma.js';

const TOP_SEARCH_TAGS_COUNT = 50;

type DehydratedMenuItem = MenuItem & {
	modifiers: Array<{
		modifier: MenuItemModifier & {
			choices: Array<MenuItemModifierChoice>;
		}
	}>;
	searchTags: Array<{
		name: string;
	}>;
}

const hydrateMenuItem = (menuItem: DehydratedMenuItem): IMenuItemBase => {
	const modifiers: IMenuItemModifier[] = [];
	for (const modifierEntry of menuItem.modifiers) {
		modifiers.push({
			id:          modifierEntry.modifier.id,
			description: modifierEntry.modifier.description,
			minimum:     modifierEntry.modifier.minimum,
			maximum:     modifierEntry.modifier.maximum,
			// Maybe a bad idea?
			choiceType: modifierEntry.modifier.choiceType as ModifierChoiceType,
			choices:    modifierEntry.modifier.choices.map(choice => ({
				id:          choice.id,
				description: choice.description,
				price:       choice.price
			}))
		});
	}

	return {
		id:             menuItem.id,
		stationId:      menuItem.stationId,
		cafeId:         menuItem.cafeId,
		name:           menuItem.name,
		description:    menuItem.description,
		price:          menuItem.price,
		calories:       menuItem.calories,
		maxCalories:    menuItem.maxCalories,
		imageUrl:       menuItem.imageUrl,
		lastUpdateTime: menuItem.externalLastUpdateTime,
		receiptText:    menuItem.externalReceiptText,
		groupId:        menuItem.groupId,
		tags:           deserializeMenuItemTags(menuItem.tags),
		searchTags:     new Set(menuItem.searchTags.map(tag => tag.name)),
		hasThumbnail:   false,
		modifiers
	};
}

export abstract class MenuItemStorageClient {
	private static readonly _menuItemsById = new Map<string, IMenuItemBase>();
	private static readonly _menuIdsBySearchTag = new Map<string, Set<string>>();
	private static _topSearchTags: string[] | undefined;

	static get topSearchTags(): string[] {
		if (this._topSearchTags == null) {
			const entries = Array.from(this._menuIdsBySearchTag.entries());

			entries.sort(([, idsA], [, idsB]) => {
				return idsB.size - idsA.size;
			});

			this._topSearchTags = entries.slice(0, TOP_SEARCH_TAGS_COUNT).map(([tag]) => tag);
		}

		return this._topSearchTags;
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

	private static async _doCreateModifierChoiceAsync(prismaClient: PrismaLikeClient, modifier: IMenuItemModifier, choice: IMenuItemModifierChoice): Promise<void> {
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

	private static async _doCreateSingleModifierAsync(prismaClient: PrismaLikeClient, modifier: IMenuItemModifier): Promise<void> {
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

	private static async _doSaveMenuItemAsync(menuItem: IMenuItemBase, allowUpdateIfExisting: boolean): Promise<void> {
		const lastUpdateTime = menuItem.lastUpdateTime == null || Number.isNaN(menuItem.lastUpdateTime.getTime())
			? null
			: menuItem.lastUpdateTime;

		const modifierEntriesById = new Map<string, MenuItemModifierEntry>();
		for (let i = 0; i < menuItem.modifiers.length; i++) {
			const modifier = menuItem.modifiers[i]!;
			modifierEntriesById.set(modifier.id, {
				modifierId: modifier.id,
				menuItemId: menuItem.id,
				index:      i
			});
		}

		const modifierIdsToCreate = new Set(modifierEntriesById.keys());

		const dataWithoutId = {
			cafeId:                 menuItem.cafeId,
			stationId:              menuItem.stationId,
			name:                   menuItem.name.trim(),
			normalizedName:         normalizeNameForSearch(menuItem.name),
			imageUrl:               menuItem.imageUrl || null,
			description:            menuItem.description?.trim() || null,
			price:                  Number(menuItem.price || 0),
			calories:               Number(menuItem.calories || 0),
			maxCalories:            Number(menuItem.maxCalories || 0),
			tags:                   serializeMenuItemTags(menuItem.tags),
			externalLastUpdateTime: lastUpdateTime,
			externalReceiptText:    menuItem.receiptText || null
		} as const;

		const data = {
			id: menuItem.id,
			...dataWithoutId
		};

		await usePrismaTransaction(async prismaClient => {
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
								modifierId: true
							}
						}
					}
				});

				if (existingItem != null) {
					// Menu items should have only a few modifiers, this complexity is fine.
					const modifierIdsRemovedFromThisItem: string[] = [];
					for (const existingModifier of existingItem.modifiers) {
						if (!modifierIdsToCreate.has(existingModifier.modifierId)) {
							modifierIdsRemovedFromThisItem.push(existingModifier.modifierId);
						} else {
							modifierIdsToCreate.delete(existingModifier.modifierId);
						}
					}

					if (modifierIdsRemovedFromThisItem.length > 0) {
						await prismaClient.menuItemModifierEntry.deleteMany({
							where: {
								menuItemId: menuItem.id,
								modifierId: {
									in: modifierIdsRemovedFromThisItem
								}
							}
						});
					}

					await prismaClient.menuItem.update({
						where: {
							id: menuItem.id
						},
						data:  {
							...dataWithoutId
						}
					});
				} else {
					await prismaClient.menuItem.create({ data });
				}
			} else {
				try {
					await prismaClient.menuItem.create({ data });
				} catch (err) {
					// OK to fail unique constraint validation since we don't want to update existing items
					if (!isUniqueConstraintFailedError(err)) {
						throw err;
					}
				}
			}

			if (modifierIdsToCreate.size > 0) {
				const existingItems = await prismaClient.menuItemModifierEntry.findMany({
					where: {
						modifierId: {
							in: Array.from(modifierIdsToCreate)
						}
					},
					select: {
						modifierId: true
					}
				});

				for (const existingItem of existingItems) {
					modifierIdsToCreate.delete(existingItem.modifierId);
				}

				await prismaClient.menuItemModifierEntry.createMany({
					data: Array.from(modifierIdsToCreate).map(modifierId => modifierEntriesById.get(modifierId)!)
				});
			}
		});
	}

	public static async saveMenuItemAsync(menuItem: IMenuItemBase, allowUpdateIfExisting: boolean = false): Promise<void> {
		if (!allowUpdateIfExisting && MenuItemStorageClient._menuItemsById.has(menuItem.id)) {
			return;
		}

		await MenuItemStorageClient._doSaveMenuItemAsync(menuItem, allowUpdateIfExisting);

		// Require the save operation to succeed before adding to cache
		this._saveMenuItemIntoCache(menuItem);
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

	private static async _doRetrieveMenuItemAsync(id: string): Promise<IMenuItemBase | null> {
		const menuItem = await usePrismaClient(prismaClient => prismaClient.menuItem.findUnique({
			where:   { id },
			include: {
				modifiers:  {
					include: {
						modifier: {
							include: {
								choices: true
							}
						}
					},
					orderBy: {
						index: 'asc'
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

		return hydrateMenuItem(menuItem);
	}

	private static _saveMenuItemIntoCache(menuItem: IMenuItemBase) {
		this._menuItemsById.set(menuItem.id, menuItem);
		for (const searchTag of menuItem.searchTags) {
			const menuItemIds = this._menuIdsBySearchTag.get(searchTag) ?? new Set<string>();
			menuItemIds.add(menuItem.id);
			this._menuIdsBySearchTag.set(searchTag, menuItemIds);
		}
		// we added new tags, just reset and recompute next time
		this._topSearchTags = undefined;
	}

	public static async retrieveMenuItemAsync(id: string): Promise<IMenuItemBase | null> {
		if (!this._menuItemsById.has(id)) {
			const menuItem = await this._doRetrieveMenuItemAsync(id);

			if (menuItem == null) {
				return null;
			}

			this._saveMenuItemIntoCache(menuItem);
		}

		return this._menuItemsById.get(id)!;
	}

	public static async retrieveMenuItemsForWeeklyMenuAsync(): Promise<void> {
		const dateStrings = getDateStringsForWeek();

		const menuResults = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
			where:  {
				dateString: {
					in: dateStrings
				}
			},
			select: {
				categories: {
					select: {
						menuItems: {
							select: {
								menuItem: {
									include: {
										modifiers:  {
											include: {
												modifier: {
													include: {
														choices: true
													}
												}
											},
											orderBy: {
												index: 'asc'
											}
										},
										searchTags: {
											select: {
												name: true
											}
										}
									}
								}
							},
						}
					}
				},
			}
		}));

		let menuItemCount = 0;

		for (const { categories } of menuResults) {
			for (const { menuItems } of categories) {
				for (const { menuItem } of menuItems) {
					const hydratedItem = hydrateMenuItem(menuItem);
					this._saveMenuItemIntoCache(hydratedItem);
					menuItemCount++;
				}
			}
		}

		logInfo(`Retrieved ${menuItemCount} menu items for weekly menu on boot`);
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
				where:  {
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

	public static async retrieveAllMenuItemsWithoutGroup(): Promise<Array<IMenuItemBase>> {
		const menuItemIds = await usePrismaClient(prismaClient => prismaClient.menuItem.findMany({
			where:  {
				groupId: null
			},
			select: {
				id: true
			}
		}));

		const menuItems = await Promise.all(menuItemIds.map(({ id }) => this.retrieveMenuItemAsync(id)));
		return menuItems.filter((item): item is IMenuItemBase => item != null);
	}
}