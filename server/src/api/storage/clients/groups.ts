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
import { SearchEntityType, searchEntityTypeFromString } from '@msdining/common/models/search';
import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import { PrismaLikeClient } from '../../../models/prisma.js';
import hat from 'hat';

interface IResultWithId {
	id: string;
}

export const extractMenuItemsAsync = async (results: Array<IResultWithId>): Promise<Array<IGroupMember>> => {
	const menuItems = await Promise.all(results.map(result => MenuItemStorageClient.retrieveMenuItemAsync(result.id)));
	return Promise.all(
		menuItems
			.filter((item): item is IMenuItemBase => item !== null)
			.map(menuItemToGroupMember)
	);
}

export const extractStationsAsync = async (results: Array<IResultWithId>): Promise<Array<IGroupMember>> => {
	const stations = await Promise.all(results.map((result) => StationStorageClient.retrieveStationAsync(result.id)));
	return stations
		.filter((station): station is Station => station !== null)
		.map(stationToGroupMember);
}

export const menuItemToGroupMember = async (menuItem: IMenuItemBase): Promise<IGroupMember> => {
	const station = await StationStorageClient.retrieveStationAsync(menuItem.stationId);

	return ({
		id:       menuItem.id,
		name:     menuItem.name,
		type:     SearchEntityType.menuItem,
		imageUrl: menuItem.imageUrl || undefined,
		metadata: {
			cafe: menuItem.cafeId,
			stationName: station?.name || '',
			stationLogoUrl: station?.logoUrl || ''
		}
	});
};

export const stationToGroupMember = (station: Station): IGroupMember => ({
	id:       station.id,
	name:     station.name,
	type:     SearchEntityType.station,
	imageUrl: station.logoUrl || undefined
});

interface IGroupResult {
	menuItems: Array<IResultWithId>;
	stations: Array<IResultWithId>;
}

const getGroupResultMembers = async (result: IGroupResult): Promise<Array<IGroupMember>> => {
	const [menuItems, stations] = await Promise.all([
		extractMenuItemsAsync(result.menuItems),
		extractStationsAsync(result.stations)
	]);

	return [
		...menuItems,
		...stations
	];
}

export abstract class GroupStorageClient {
	static async #getMenuItemCandidatesZeroContext(): Promise<Array<Array<IGroupMember>>> {
		const results = await usePrismaClient(async prisma => {
			return prisma.$queryRawTyped(getMenuItemGroupCandidatesZeroContext());
		});

		const menuItemsByNormalizedName = new Map<string /*normalizedName*/, Array<IGroupMember>>();

		const menuItems = await extractMenuItemsAsync(results);

		for (const item of menuItems) {
			const normalizedName = normalizeNameForSearch(item.name);
			const itemsForName = menuItemsByNormalizedName.get(normalizedName) ?? [];
			itemsForName.push(item);
			menuItemsByNormalizedName.set(normalizedName, itemsForName);
		}

		return Array.from(menuItemsByNormalizedName.values());
	}

	static async #getStationCandidatesZeroContext(): Promise<Array<Array<IGroupMember>>> {
		const results = await usePrismaClient(async prisma => {
			return prisma.$queryRawTyped(getStationGroupCandidatesZeroContext());
		});

		const stations = await extractStationsAsync(results);
		const stationsByNormalizedName = new Map<string /*normalizedName*/, Array<IGroupMember>>();
		for (const station of stations) {
			const normalizedName = normalizeNameForSearch(station.name);
			const stationsForName = stationsByNormalizedName.get(normalizedName) ?? [];
			stationsForName.push(station);
			stationsByNormalizedName.set(normalizedName, stationsForName);
		}

		return Array.from(stationsByNormalizedName.values());
	}

	public static async getGroupCandidatesZeroContext(): Promise<Array<IGroupData>> {
		const results: IGroupData[] = [];
		const [menuItemCandidates, stationCandidates] = await Promise.all([
			this.#getMenuItemCandidatesZeroContext(),
			this.#getStationCandidatesZeroContext()
		]);

		const mapResultsToGroups = (type: SearchEntityType, map: Map<string /*suggestedGroupName*/, Array<IGroupMember>>): Array<IGroupData> => {
			return Array.from(map.entries()).map(([suggestedGroupName, members]) => ({
				name: suggestedGroupName,
				id:   hat(),
				type,
				members,
			} satisfies IGroupData));
		}

		const menuItemResults = new Map<string /*suggestedGroupName*/, Array<IGroupMember>>();
		for (const menuItemGroup of menuItemCandidates) {
			if (menuItemGroup.length === 0) {
				continue;
			}

			const suggestedGroupName = menuItemGroup[0]!.name;
			menuItemResults.set(suggestedGroupName, menuItemGroup);
		}

		results.push(...mapResultsToGroups(SearchEntityType.menuItem, menuItemResults));

		const stationResults = new Map<string /*suggestedGroupName*/, Array<IGroupMember>>();
		for (const stationGroup of stationCandidates) {
			if (stationGroup.length === 0) {
				continue;
			}

			const suggestedGroupName = stationGroup[0]!.name;
			stationResults.set(suggestedGroupName, stationGroup);
		}

		results.push(...mapResultsToGroups(SearchEntityType.station, stationResults));

		return results;
	}

	static async #getMenuItemCandidatesForGroup(groupId: string): Promise<Array<IGroupMember>> {
		const results = await usePrismaClient(async prisma => {
			return prisma.$queryRawTyped(getMenuItemGroupCandidatesForGroup(groupId));
		});

		return extractMenuItemsAsync(results);
	}

	static async #getStationCandidatesForGroup(groupId: string): Promise<Array<IGroupMember>> {
		const results = await usePrismaClient(async prisma => {
			return prisma.$queryRawTyped(getStationGroupCandidatesForGroup(groupId));
		});

		return extractStationsAsync(results);
	}

	public static async getCandidatesForGroup(groupId: string): Promise<Array<IGroupMember>> {
		const candidates: Array<IGroupMember> = [];

		const [menuItemCandidates, stationCandidates] = await Promise.all([
			this.#getMenuItemCandidatesForGroup(groupId),
			this.#getStationCandidatesForGroup(groupId)
		]);

		candidates.push(
			...menuItemCandidates,
			...stationCandidates
		);

		return candidates;
	}

	public static async getGroups(): Promise<Array<IGroupData>> {
		const groupResults = await usePrismaClient(async prisma => {
			return prisma.crossCafeGroup.findMany({
				orderBy: {
					name: 'asc',
				},
				select:  {
					id:         true,
					name:       true,
					entityType: true,
					menuItems:  {
						select: {
							id: true
						}
					},
					stations:   {
						select: {
							id: true
						}
					}
				}
			});
		});

		return Promise.all(groupResults.map(async groupResult => {
			const members = await getGroupResultMembers(groupResult);

			return {
				id:   groupResult.id,
				name: groupResult.name,
				type: SearchEntityType[groupResult.entityType as keyof typeof SearchEntityType],
				members
			} satisfies IGroupData;
		}));
	}

	public static async getGroupMembers(groupId: string): Promise<Array<IGroupMember>> {
		const groupResult = await usePrismaClient(async prisma => {
			return prisma.crossCafeGroup.findUnique({
				where:  {
					id: groupId
				},
				select: {
					menuItems: {
						select: {
							id:   true,
							name: true
						}
					},
					stations:  {
						select: {
							id:   true,
							name: true
						}
					}
				}
			});
		});

		if (!groupResult) {
			throw new Error(`Group with ID ${groupId} not found`);
		}

		return getGroupResultMembers(groupResult);
	}

	static async #setGroupMembersInternal(prima: PrismaLikeClient, groupId: string, memberIds: Array<string>, entityType: SearchEntityType): Promise<void> {
		if (entityType === SearchEntityType.station) {
			await prima.station.updateMany({
				where: {
					id: {
						in: memberIds
					}
				},
				data:  {
					groupId
				}
			});
		} else if (entityType === SearchEntityType.menuItem) {
			await prima.menuItem.updateMany({
				where: {
					id: {
						in: memberIds
					}
				},
				data:  {
					groupId
				}
			});
		}
	}

	public static async addToGroup(groupId: string, memberIds: Array<string>): Promise<void> {
		await usePrismaClient(async prisma => {
			await prisma.$transaction(async tx => {
				const group = await tx.crossCafeGroup.findUnique({
					where:   {
						id: groupId
					},
					include: {
						menuItems: true,
						stations:  true
					}
				});

				if (!group) {
					throw new Error(`Group with ID ${groupId} not found`);
				}

				const targetMemberIds = new Set(group.entityType === SearchEntityType.menuItem
					? group.menuItems.map(item => item.id)
					: group.stations.map(station => station.id));

				const newMemberIds = memberIds.filter(id => !targetMemberIds.has(id));

				if (newMemberIds.length === 0) {
					return;
				}

				await this.#setGroupMembersInternal(tx, groupId, newMemberIds, searchEntityTypeFromString(group.entityType));
			});
		});
	}

	public static async createGroup(name: string, entityType: SearchEntityType, initialMembers: Array<string> = []): Promise<CrossCafeGroup> {
		return usePrismaClient(async prisma => {
			return prisma.$transaction(async tx => {
				const newGroup = await tx.crossCafeGroup.create({
					data: {
						name,
						entityType
					}
				});

				if (initialMembers.length > 0) {
					await this.#setGroupMembersInternal(tx, newGroup.id, initialMembers, entityType);
				}

				return newGroup;
			});
		});
	}

	public static async deleteGroup(id: string): Promise<void> {
		await usePrismaClient(async prisma => {
			return prisma.crossCafeGroup.delete({
				where: {
					id
				}
			});
		});
	}

	public static async renameGroup(id: string, newName: string): Promise<void> {
		await usePrismaClient(async prisma => {
			return prisma.crossCafeGroup.update({
				where: {
					id
				},
				data:  {
					name: newName
				}
			});
		});
	}
}