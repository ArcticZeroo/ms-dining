import {
	IMenuItemModifier,
	IMenuItemModifierChoice,
	IMenuItemReviewHeader,
	ModifierChoiceType
} from '@msdining/common/dist/models/cafe.js';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { MenuItemModifier, MenuItemModifierChoice, MenuItemModifierEntry, PrismaClient } from '@prisma/client';
import { IMenuItem } from '../../../models/cafe.js';
import { deserializeMenuItemTags, serializeMenuItemTags } from '../../../util/cafe.js';
import { logDebug } from '../../../util/log.js';
import { isUniqueConstraintFailedError } from '../../../util/prisma.js';
import { ISearchTagQueueEntry } from '../../../worker/queues/search-tags.js';
import { usePrismaClient } from '../client.js';
import { retrieveThumbnailData } from '../../../worker/client/thumbnail.js';

const TOP_SEARCH_TAGS_COUNT = 50;

export abstract class MenuItemStorageClient {
	private static readonly _menuItemsById = new Map<string, IMenuItem>();
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

		const modifierEntriesById = new Map<string, MenuItemModifierEntry>();
		for (let i = 0; i < menuItem.modifiers.length; i++) {
			const modifier = menuItem.modifiers[i]!;
			modifierEntriesById.set(modifier.id, {
				modifierId: modifier.id,
				menuItemId: menuItem.id,
				index:      i
			});
		}

		const modifierIdsToAdd = new Set(modifierEntriesById.keys());

		const dataWithoutId = {
			cafeId:                 menuItem.cafeId,
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
								modifierId: true
							}
						}
					}
				});

				if (existingItem != null) {
					// Menu items should have only a few modifiers, this complexity is fine.
					const modifierIdsToRemove: string[] = [];
					for (const existingModifier of existingItem.modifiers) {
						if (!modifierIdsToAdd.has(existingModifier.modifierId)) {
							modifierIdsToRemove.push(existingModifier.modifierId);
						} else {
							modifierIdsToAdd.delete(existingModifier.modifierId);
						}
					}

					if (modifierIdsToRemove.length > 0) {
						await prismaClient.menuItemModifierEntry.deleteMany({
							where: {
								menuItemId: menuItem.id,
								modifierId: {
									in: modifierIdsToRemove
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

			if (modifierIdsToAdd.size > 0) {
				const modifierEntriesToAdd = Array.from(modifierIdsToAdd).map(modifierId => modifierEntriesById.get(modifierId)!);
				await prismaClient.menuItemModifierEntry.createMany({
					data: modifierEntriesToAdd
				});
			}
		});
	}

	public static async saveMenuItemAsync(menuItem: IMenuItem, allowUpdateIfExisting: boolean = false): Promise<void> {
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

	// todo... consider showing a different review count for this vs other cafes.
	// might not actually be necessary since there is so little data in general.
	private static async _retrieveReviewHeaderAsync(normalizedName: string): Promise<IMenuItemReviewHeader> {
		const stats = await usePrismaClient(prismaClient => prismaClient.review.aggregate({
			where: {
				menuItem: {
					normalizedName
				}
			},
			_count: true,
			_avg: {
				rating: true
			}
		}));

		return {
			totalReviewCount: stats._count,
			overallRating: stats._avg.rating ?? 0
		};
	}

	private static async _doRetrieveMenuItemAsync(id: string): Promise<IMenuItem | null> {
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

		const [thumbnailData, reviewHeader] = await Promise.all([
			retrieveThumbnailData(menuItem),
			MenuItemStorageClient._retrieveReviewHeaderAsync(menuItem.normalizedName)
		]);

		return {
			id:             menuItem.id,
			cafeId:         menuItem.cafeId,
			name:           menuItem.name,
			description:    menuItem.description,
			price:          menuItem.price,
			calories:       menuItem.calories,
			maxCalories:    menuItem.maxCalories,
			imageUrl:       menuItem.imageUrl,
			lastUpdateTime: menuItem.externalLastUpdateTime,
			receiptText:    menuItem.externalReceiptText,
			tags:           deserializeMenuItemTags(menuItem.tags),
			searchTags:     new Set(menuItem.searchTags.map(tag => tag.name)),
			...reviewHeader,
			...thumbnailData,
			modifiers
		};
	}

	private static _saveMenuItemIntoCache(menuItem: IMenuItem) {
		this._menuItemsById.set(menuItem.id, menuItem);
		for (const searchTag of menuItem.searchTags) {
			const menuItemIds = this._menuIdsBySearchTag.get(searchTag) ?? new Set<string>();
			menuItemIds.add(menuItem.id);
			this._menuIdsBySearchTag.set(searchTag, menuItemIds);
		}
		// we added new tags, just reset and recompute next time
		this._topSearchTags = undefined;
	}

	public static async retrieveMenuItemAsync(id: string): Promise<IMenuItem | null> {
		if (!this._menuItemsById.has(id)) {
			const menuItem = await this._doRetrieveMenuItemAsync(id);

			if (menuItem == null) {
				return null;
			}

			this._saveMenuItemIntoCache(menuItem);
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
}