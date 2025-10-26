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
import { IGroupCandidate } from '@msdining/common/models/group';

export abstract class GroupStorageClient {
	static async #getMenuItemCandidatesZeroContext(): Promise<Array<Array<IMenuItemBase>>> {
		const results = await usePrismaClient(async prisma => {
			return prisma.$queryRawTyped(getMenuItemGroupCandidatesZeroContext());
		});

		const menuItemsByNormalizedName = new Map<string /*normalizedName*/, Array<IMenuItemBase>>();

		const menuItems = await Promise.all(results.map(result => MenuItemStorageClient.retrieveMenuItemAsync(result.id)));

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

		const stations = await Promise.all(results.map((result) => StationStorageClient.retrieveStationAsync(result.id)));
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

	public static async getGroupCandidatesZeroContext(): Promise<Array<[string /*suggestedGroupName*/, Array<IGroupCandidate>]>> {
		const results = new Map<SearchEntityType, Map<string /*suggestedGroupName*/, Array<IGroupCandidate>>>();
		const [menuItemCandidates, stationCandidates] = await Promise.all([
			this.#getMenuItemCandidatesZeroContext(),
			this.#getStationCandidatesZeroContext()
		]);

		const menuItemResults = new Map<string /*suggestedGroupName*/, Array<IGroupCandidate>>();
		for (const menuItemGroup of menuItemCandidates) {
			if (menuItemGroup.length === 0) {
				continue;
			}

			const suggestedGroupName = menuItemGroup[0]!.name;
			const groupCandidates: Array<IGroupCandidate> = menuItemGroup.map(menuItem => ({
				id:         menuItem.id,
				name:       menuItem.name,
				type: SearchEntityType.menuItem,
			}));

			menuItemResults.set(suggestedGroupName, groupCandidates);
		}

		if (menuItemResults.size > 0) {
			results.set(SearchEntityType.menuItem, menuItemResults);
		}

		const stationResults = new Map<string /*suggestedGroupName*/, Array<IGroupCandidate>>();
		for (const stationGroup of stationCandidates) {
			if (stationGroup.length === 0) {
				continue;
			}

			const suggestedGroupName = stationGroup[0]!.name;
			const groupCandidates: Array<IGroupCandidate> = stationGroup.map(station => ({
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

		const menuItems = await Promise.all(results.map(result => MenuItemStorageClient.retrieveMenuItemAsync(result.id)));

		return menuItems.filter((item): item is IMenuItemBase => item !== null);
	}

	static async #getStationCandidatesForGroup(group: CrossCafeGroup): Promise<Array<Station>> {
		const results = await usePrismaClient(async prisma => {
			return prisma.$queryRawTyped(getStationGroupCandidatesForGroup(group.id));
		});

		const stations = await Promise.all(results.map((result) => StationStorageClient.retrieveStationAsync(result.id)));

		return stations.filter((station): station is Station => station !== null);
	}

	public static async getCandidatesForGroup(group: CrossCafeGroup): Promise<Array<IGroupCandidate>> {
		const candidates: Array<IGroupCandidate> = [];

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
}