import { usePrismaClient } from '../client.js';
import {
	getMenuItemGroupCandidatesForGroup,
	getMenuItemGroupCandidatesZeroContext,
	getStationGroupCandidatesForGroup,
	getStationGroupCandidatesZeroContext
} from '@prisma/client/sql';
import { IMenuItemBase } from '@msdining/common/models/cafe';
import { MenuItemStorageClient } from './menu-item.js';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';
import { StationStorageClient } from './station.js';
import { CrossCafeGroup, Station } from '@prisma/client';
import { SearchEntityType } from '@msdining/common/models/search';
import { IGroupMember } from '@msdining/common/models/group';
import { IGroupData } from '@msdining/common/models/group';
import { SEARCH_ENTITY_TYPE_NAME_TO_ENUM } from '@msdining/common/models/search';

const extractMenuItemsAsync = async (results: Array<{ id: string }>): Promise<Array<IMenuItemBase>> => {
	const menuItems = await Promise.all(results.map(result => MenuItemStorageClient.retrieveMenuItemAsync(result.id)));
	return menuItems.filter((item): item is IMenuItemBase => item !== null);
}

const extractStationsAsync = async (results: Array<{ id: string }>): Promise<Array<Station>> => {
	const stations = await Promise.all(results.map((result) => StationStorageClient.retrieveStationAsync(result.id)));
	return stations.filter((station): station is Station => station !== null);
}

export abstract class GroupStorageClient {
	static async #getMenuItemCandidatesZeroContext(): Promise<Array<Array<IMenuItemBase>>> {
		const results = await usePrismaClient(async prisma => {
			return prisma.$queryRawTyped(getMenuItemGroupCandidatesZeroContext());
		});

		const menuItemsByNormalizedName = new Map<string /*normalizedName*/, Array<IMenuItemBase>>();

		const menuItems = await extractMenuItemsAsync(results);

		for (const item of menuItems) {
			if (!item) {
				continue;
			}

			const normalizedName = normalizeNameForSearch(item.name);
			const itemsForName = menuItemsByNormalizedName.get(normalizedName) ?? [];
			itemsForName.push(item);
			menuItemsByNormalizedName.set(normalizedName, itemsForName);
		}

		return Array.from(menuItemsByNormalizedName.values());
	}

	static async #getStationCandidatesZeroContext(): Promise<Array<Array<Station>>> {
		const results = await usePrismaClient(async prisma => {
			return prisma.$queryRawTyped(getStationGroupCandidatesZeroContext());
		});

		const stations = await extractStationsAsync(results);
		const stationsByNormalizedName = new Map<string /*normalizedName*/, Array<Station>>();
		for (const station of stations) {
			if (!station) {
				continue;
			}

			const normalizedName = normalizeNameForSearch(station.name);
			const stationsForName = stationsByNormalizedName.get(normalizedName) ?? [];
			stationsForName.push(station);
			stationsByNormalizedName.set(normalizedName, stationsForName);
		}

		return Array.from(stationsByNormalizedName.values());
	}

	public static async getGroupCandidatesZeroContext(): Promise<Array<[string /*suggestedGroupName*/, Array<IGroupMember>]>> {
		const results = new Map<SearchEntityType, Map<string /*suggestedGroupName*/, Array<IGroupMember>>>();
		const [menuItemCandidates, stationCandidates] = await Promise.all([
			this.#getMenuItemCandidatesZeroContext(),
			this.#getStationCandidatesZeroContext()
		]);

		const menuItemResults = new Map<string /*suggestedGroupName*/, Array<IGroupMember>>();
		for (const menuItemGroup of menuItemCandidates) {
			if (menuItemGroup.length === 0) {
				continue;
			}

			const suggestedGroupName = menuItemGroup[0]!.name;
			const groupCandidates: Array<IGroupMember> = menuItemGroup.map(menuItem => ({
				id:         menuItem.id,
				name:       menuItem.name,
				type: SearchEntityType.menuItem,
			}));

			menuItemResults.set(suggestedGroupName, groupCandidates);
		}

		if (menuItemResults.size > 0) {
			results.set(SearchEntityType.menuItem, menuItemResults);
		}

		const stationResults = new Map<string /*suggestedGroupName*/, Array<IGroupMember>>();
		for (const stationGroup of stationCandidates) {
			if (stationGroup.length === 0) {
				continue;
			}

			const suggestedGroupName = stationGroup[0]!.name;
			const groupCandidates: Array<IGroupMember> = stationGroup.map(station => ({
				id:         station.id,
				name:       station.name,
				type: SearchEntityType.station,
			}));

			stationResults.set(suggestedGroupName, groupCandidates);
		}

		if (stationResults.size > 0) {
			results.set(SearchEntityType.station, stationResults);
		}

		return Array.from(results.values()).flatMap(map => Array.from(map.entries()));
	}

	static async #getMenuItemCandidatesForGroup(group: CrossCafeGroup): Promise<Array<IMenuItemBase>> {
		const results = await usePrismaClient(async prisma => {
			return prisma.$queryRawTyped(getMenuItemGroupCandidatesForGroup(group.id));
		});

		const menuItems = await extractMenuItemsAsync(results);
		return menuItems.filter((item): item is IMenuItemBase => item !== null);
	}

	static async #getStationCandidatesForGroup(group: CrossCafeGroup): Promise<Array<Station>> {
		const results = await usePrismaClient(async prisma => {
			return prisma.$queryRawTyped(getStationGroupCandidatesForGroup(group.id));
		});
		return await extractStationsAsync(results);
	}

	public static async getCandidatesForGroup(group: CrossCafeGroup): Promise<Array<IGroupMember>> {
		const candidates: Array<IGroupMember> = [];

		const [menuItemCandidates, stationCandidates] = await Promise.all([
			this.#getMenuItemCandidatesForGroup(group),
			this.#getStationCandidatesForGroup(group)
		]);

		for (const menuItem of menuItemCandidates) {
			candidates.push({
				id:         menuItem.id,
				name:       menuItem.name,
				type: SearchEntityType.menuItem,
			});
		}

		for (const station of stationCandidates) {
			candidates.push({
				id:         station.id,
				name:       station.name,
				type: SearchEntityType.station,
			});
		}

		return candidates;
	}

	public static async getGroups(): Promise<Array<IGroupData>> {
		const groupResults = await usePrismaClient(async prisma => {
			return prisma.crossCafeGroup.findMany({
				orderBy: {
					name: 'asc',
				},
				select: {
					id: true,
					name: true,
					entityType: true,
					menuItems: {
						select: {
							id: true
						}
					},
					stations: {
						select: {
							id: true
						}
					}
				}
			});
		});

		return Promise.all(groupResults.map(async groupResult => {
			const members: Array<IGroupMember> = [];

			// Don't need to Promise.all because only one will be populated
			for (const menuItem of await extractMenuItemsAsync(groupResult.menuItems)) {
				members.push({
					id:         menuItem.id,
					name:       menuItem.name,
					type: SearchEntityType.menuItem,
				});
			}

			for (const station of await extractStationsAsync(groupResult.stations)) {
				members.push({
					id:         station.id,
					name:       station.name,
					type: SearchEntityType.station,
				});
			}

			return {
				id: groupResult.id,
				name: groupResult.name,
				type: SearchEntityType[groupResult.entityType as keyof typeof SearchEntityType],
				members
			} satisfies IGroupData;
		}));
	}
}