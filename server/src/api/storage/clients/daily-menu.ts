import { DateUtil } from '@msdining/common';
import { normalizeNameForSearch } from '@msdining/common/dist/util/search-util.js';
import { ICafe, ICafeStation, IMenuItem } from '../../../models/cafe.js';
import { isDateValid } from '../../../util/date.js';
import { logError } from '../../../util/log.js';
import { usePrismaClient } from '../client.js';
import { MenuItemStorageClient } from './menu-item.js';
import { SearchEntityType } from '@msdining/common/dist/models/search.js';
import { IEntityVisitData } from '@msdining/common/dist/models/pattern.js';
import { IMenuPublishEvent } from '../../../models/storage-events.js';
import { STORAGE_EVENTS } from '../events.js';

const areMenuItemsByCategoryNameEqual = (a: Map<string, Array<string>>, b: Map<string, Array<string>>) => {
	if (a.size !== b.size) {
		return false;
	}

	for (const [categoryName, menuItemIds] of a.entries()) {
		const otherMenuItemIds = b.get(categoryName);
		if (otherMenuItemIds == null || menuItemIds.length !== otherMenuItemIds.length) {
			return false;
		}

		if (!menuItemIds.every(menuItemId => otherMenuItemIds.includes(menuItemId))) {
			return false;
		}
	}

	return true;
}

interface IPublishDailyMenuParams {
	cafe: ICafe;
	dateString: string;
	stations: Array<ICafeStation>;
}

interface ICafeMenuOverviewHeader {
	name: string;
	logoUrl?: string;
}

// TODO: Clean this up so that it doesn't rely on the MenuItemStorageClient directly.
//   Maybe the storage clients should not have a cache, and we will rely on a higher-level orchestrator to figure out
//   the caching story across all of the storage clients?
export abstract class DailyMenuStorageClient {
	public static async publishDailyStationMenuAsync({ cafe, dateString, stations }: IPublishDailyMenuParams) {
		const cafeId = cafe.id;

		const publishEvent: IMenuPublishEvent = {
			cafe,
			dateString,
			menu: stations,
			addedStations:             new Set<string>(),
			removedStations:           new Set<string>(),
			updatedStations:           new Set<string>(),
			removedMenuItemsByStation: new Map<string, Set<string>>(),
			addedMenuItemsByStation:   new Map<string, Set<string>>()
		};

		await usePrismaClient(async (prismaClient) => prismaClient.$transaction(async tx => {
			const previousDailyStationMenus = await tx.dailyStation.findMany({
				where:  {
					cafeId,
					dateString
				},
				select: {
					stationId:  true,
					categories: {
						select: {
							name:      true,
							menuItems: {
								select: {
									menuItemId: true
								}
							}
						}
					}
				}
			});

			await tx.dailyStation.deleteMany({
				where: {
					dateString,
					cafeId
				}
			});

			for (const previousStation of previousDailyStationMenus) {
				publishEvent.removedStations.add(previousStation.stationId);
			}

			for (const station of stations) {
				// Calculate diff info for the event
				if (publishEvent.removedStations.has(station.id)) {
					publishEvent.removedStations.delete(station.id);

					const previousMenu = previousDailyStationMenus.find(s => s.stationId === station.id);
					if (!previousMenu) {
						throw new Error(`Missing previous menu for station ${station.id} on date ${dateString}`);
					}

					const removedItemIds = new Set<string>(previousMenu.categories.flatMap(category => category.menuItems.map(item => item.menuItemId)));
					const addedItemIds = new Set<string>();

					for (const menuItemId of station.menuItemsById.keys()) {
						if (removedItemIds.has(menuItemId)) {
							removedItemIds.delete(menuItemId);
						} else {
							addedItemIds.add(menuItemId);
						}
					}

					// If anything was added or removed, we know that the station has been updated.
					if (removedItemIds.size != 0 || addedItemIds.size != 0) {
						publishEvent.updatedStations.add(station.id);
					} else {
						// Otherwise, let's check to see if categories/menu items in those categories have changed.
						// (e.g. a menu item might have been added to a second category)
						const previousMenuItemIdsByCategoryName = new Map<string, Array<string>>();
						for (const category of previousMenu.categories) {
							previousMenuItemIdsByCategoryName.set(category.name, category.menuItems.map(item => item.menuItemId));
						}

						if (!areMenuItemsByCategoryNameEqual(previousMenuItemIdsByCategoryName, station.menuItemIdsByCategoryName)) {
							publishEvent.updatedStations.add(station.id);
						}
					}

					publishEvent.removedMenuItemsByStation.set(station.id, removedItemIds);
					publishEvent.addedMenuItemsByStation.set(station.id, addedItemIds);
				} else {
					publishEvent.addedStations.add(station.id);
					publishEvent.updatedStations.add(station.id);
					publishEvent.addedMenuItemsByStation.set(station.id, new Set(station.menuItemsById.keys()));
				}

				await tx.dailyStation.create({
					data: {
						cafeId,
						dateString,
						stationId:  station.id,
						categories: {
							create: Array.from(station.menuItemIdsByCategoryName.entries()).map(([name, menuItemIds]) => ({
								name,
								menuItems: {
									create: menuItemIds.map(menuItemId => ({ menuItemId }))
								}
							}))
						}
					}
				})

				// ...probably do the uniqueness calculation here?
			}
		}));

		STORAGE_EVENTS.emit('menuPublished', publishEvent);
	}

	public static async retrieveDailyMenuAsync(cafeId: string, dateString: string) {
		const dailyStations = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
			where:  {
				cafeId,
				dateString
			},
			select: {
				stationId:              true,
				externalLastUpdateTime: true,
				station:                {
					select: {
						name:    true,
						logoUrl: true,
						menuId:  true
					}
				},
				categories:             {
					select: {
						name:      true,
						menuItems: {
							select: {
								menuItemId: true
							}
						}
					}
				}
			}
		}));

		const stations: ICafeStation[] = [];

		for (const dailyStation of dailyStations) {
			const stationData = dailyStation.station;

			const menuItemIdsByCategoryName = new Map<string, Array<string>>();
			const menuItemsById = new Map<string, IMenuItem>();

			for (const category of dailyStation.categories) {
				const menuItemIds: string[] = [];

				for (const dailyMenuItem of category.menuItems) {
					const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(dailyMenuItem.menuItemId);

					if (menuItem == null) {
						logError(`Unable to find menu item ${dailyMenuItem.menuItemId} for category ${category.name} in station ${stationData.name} (${dailyStation.stationId})`);
						continue;
					}

					menuItemIds.push(dailyMenuItem.menuItemId);
					menuItemsById.set(menuItem.id, menuItem);
				}

				menuItemIdsByCategoryName.set(category.name, menuItemIds);
			}

			stations.push({
				id:                 dailyStation.stationId,
				menuId:             stationData.menuId,
				logoUrl:            stationData.logoUrl || undefined,
				name:               stationData.name,
				menuLastUpdateTime: isDateValid(dailyStation.externalLastUpdateTime)
										? dailyStation.externalLastUpdateTime
										: undefined,
				menuItemsById,
				menuItemIdsByCategoryName
			});
		}

		return stations;
	}

	public static async retrieveDailyMenuOverviewHeadersAsync(cafeId: string, dateString: string): Promise<Array<ICafeMenuOverviewHeader>> {
		const results = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
			where:  {
				cafeId,
				dateString
			},
			select: {
				station: {
					select: {
						name:    true,
						logoUrl: true
					}
				}
			}
		}));

		return results.map(({ station }) => ({
			name:    station.name,
			logoUrl: station.logoUrl || undefined,
		}));
	}

	public static async isAnyMenuAvailableForDayAsync(dateString: string): Promise<boolean> {
		const dailyStation = await usePrismaClient(prismaClient => prismaClient.dailyStation.findFirst({
			where:  { dateString },
			select: { id: true }
		}));

		return dailyStation != null;
	}

	public static async getCafesAvailableForDayAsync(dateString: string): Promise<Set<string /*cafeId*/>> {
		const stations = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
			where:  { dateString },
			select: { cafeId: true }
		}));

		return new Set(stations.map(station => station.cafeId));
	}

	public static async isAnyAllowedMenuAvailableForCafe(cafeId: string): Promise<boolean> {
		const currentDate = DateUtil.getMinimumDateForMenu();
		const maximumDate = DateUtil.getMaximumDateForMenu();
		const allowedDateStrings: string[] = [];
		while (!DateUtil.isDateAfter(currentDate, maximumDate)) {
			if (!DateUtil.isDateOnWeekend(currentDate)) {
				allowedDateStrings.push(DateUtil.toDateString(currentDate));
			}
			currentDate.setDate(currentDate.getDate() + 1);
		}

		const result = await usePrismaClient(client => client.dailyStation.findFirst({
			where: {
				cafeId,
				dateString: {
					in: allowedDateStrings
				}
			}
		}));

		return result != null;
	}

	public static async getPendingMenusForEmbedding() {
		const dateStrings = DateUtil.getDateStringsForWeek();

		return usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
			where:  {
				dateString: {
					in: dateStrings
				}
			},
			select: {
				cafeId:     true,
				dateString: true,
				stationId:  true,
				station:    {
					select: {
						name: true
					}
				},
				categories: {
					select: {
						name:      true,
						menuItems: {
							select: {
								menuItemId: true
							}
						}
					}
				}
			}
		}));
	}

	public static getMenusForSearch(date: Date | null) {
		const dateStrings = date != null
			? [DateUtil.toDateString(date)]
			: DateUtil.getDateStringsForWeek();

		return usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
			where:  {
				dateString: {
					in: dateStrings
				}
			},
			select: {
				cafeId:     true,
				dateString: true,
				stationId:  true,
				station:    {
					select: {
						name:    true,
						logoUrl: true,
					}
				},
				categories: {
					select: {
						name:      true,
						menuItems: {
							select: {
								menuItemId: true,
								menuItem:   {
									select: {
										tags:       true,
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
	}


	public static async retrieveCafeChildAvailability(cafeId: string, startDate: Date, endDate: Date) {
		const startString = DateUtil.toDateString(startDate);
		const endString = DateUtil.toDateString(endDate);

		const visits = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
			where:  {
				cafeId,
				dateString: {
					gte: startString,
					lte: endString
				}
			},
			select: {
				dateString: true,
				stationId:  true,
				categories: {
					select: {
						menuItems: {
							select: {
								menuItemId: true
							}
						}
					}
				}
			}
		}));

		const stationVisitsById = new Map<string, Set<string>>();
		const itemVisitsById = new Map<string, Set<string>>();

		for (const stationVisit of visits) {
			const stationId = stationVisit.stationId;
			const visitDate = stationVisit.dateString;

			if (!stationVisitsById.has(stationId)) {
				stationVisitsById.set(stationId, new Set());
			}

			stationVisitsById.get(stationId)!.add(visitDate);

			for (const category of stationVisit.categories) {
				for (const menuItem of category.menuItems) {
					const menuItemId = menuItem.menuItemId;

					if (!itemVisitsById.has(menuItemId)) {
						itemVisitsById.set(menuItemId, new Set());
					}

					itemVisitsById.get(menuItemId)!.add(visitDate);
				}
			}
		}

		return {
			stationVisitsById,
			itemVisitsById
		} as const;
	}

	public static async retrieveStationItemAvailability(stationId: string, startDate: Date, endDate: Date) {
		const startString = DateUtil.toDateString(startDate);
		const endString = DateUtil.toDateString(endDate);

		const visits = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
			where:  {
				stationId,
				dateString: {
					gte: startString,
					lte: endString
				}
			},
			select: {
				dateString: true,
				categories: {
					select: {
						menuItems: {
							select: {
								menuItemId: true
							}
						}
					}
				}
			}
		}));

		const itemVisitsById = new Map<string, Set<string>>();
		for (const stationVisit of visits) {
			const visitDate = stationVisit.dateString;

			for (const category of stationVisit.categories) {
				for (const menuItem of category.menuItems) {
					const menuItemId = menuItem.menuItemId;
					if (!itemVisitsById.has(menuItemId)) {
						itemVisitsById.set(menuItemId, new Set());
					}

					itemVisitsById.get(menuItemId)!.add(visitDate);
				}
			}
		}

		return itemVisitsById;
	}

	private static async retrieveMenuItemVisits(menuItemName: string, startDate: Date, endDate: Date): Promise<Array<IEntityVisitData>> {
		const startString = DateUtil.toDateString(startDate);
		const endString = DateUtil.toDateString(endDate);

		const visits = await usePrismaClient(prismaClient => prismaClient.dailyMenuItem.findMany({
			where:  {
				menuItem: {
					normalizedName: {
						equals: normalizeNameForSearch(menuItemName)
					}
				},
				category: {
					station: {
						dateString: {
							gte: startString,
							lte: endString
						}
					}
				}
			},
			select: {
				category: {
					select: {
						station: {
							select: {
								dateString: true,
								cafeId:     true,
							}
						}
					}
				}
			}
		}));

		return visits.map(visit => ({
			dateString: visit.category.station.dateString,
			cafeId:     visit.category.station.cafeId
		}));
	}

	private static async retrieveStationVisits(stationName: string, startDate: Date, endDate: Date): Promise<Array<IEntityVisitData>> {
		const startString = DateUtil.toDateString(startDate);
		const endString = DateUtil.toDateString(endDate);

		const visits = await usePrismaClient(prismaClient => prismaClient.dailyStation.findMany({
			where:  {
				station:    {
					name: {
						equals: stationName
					}
				},
				dateString: {
					gte: startString,
					lte: endString
				}
			},
			select: {
				dateString: true,
				cafeId:     true
			}
		}));

		return visits.map(visit => ({
			dateString: visit.dateString,
			cafeId:     visit.cafeId
		}));
	}

	private static async retrieveEntityVisitsInner(entityType: SearchEntityType, entityName: string, startDate: Date, endDate: Date) {
		if (entityType === SearchEntityType.menuItem) {
			return this.retrieveMenuItemVisits(entityName, startDate, endDate);
		}

		if (entityType === SearchEntityType.station) {
			return this.retrieveStationVisits(entityName, startDate, endDate);
		}

		throw new Error('Unsupported entity type');
	}

	public static async retrieveEntityVisits(entityType: SearchEntityType, entityName: string, startDate: Date, endDate: Date) {
		const visits = await this.retrieveEntityVisitsInner(entityType, entityName, startDate, endDate);

		const seenVisits = new Set<string>();
		const uniqueVisits: IEntityVisitData[] = [];

		for (const visit of visits) {
			const key = `${visit.dateString}-${visit.cafeId}`;
			if (seenVisits.has(key)) {
				continue;
			}

			seenVisits.add(key);
			uniqueVisits.push(visit);
		}

		return uniqueVisits;
	}

	public static async retrieveFirstStationVisitDate(cafeId: string, stationId: string): Promise<Date | null> {
		const visit = await usePrismaClient(prismaClient => prismaClient.dailyStation.findFirst({
			where:  {
				cafeId,
				stationId
			},
			orderBy: {
				dateString: 'asc'
			},
			select: {
				dateString: true
			}
		}));

		if (visit == null) {
			return null;
		}

		return DateUtil.fromDateString(visit.dateString);
	}
}