import { GroupStorageClient } from '../api/storage/clients/groups.js';
import { SearchEntityType } from '@msdining/common/models/search';
import { usePrismaClient } from '../api/storage/client.js';

console.log('Fetching group candidates without context...');

const candidates = await GroupStorageClient.getGroupCandidatesZeroContext();

console.log('Checking', candidates.length, 'candidates to create default groups...');

const isSameStation = async (memberIds: string[]): Promise<boolean> => {
	const queryResult = await usePrismaClient(prisma => {
		return prisma.menuItem.findMany({
			where: {
				id: {
					in: memberIds
				}
			},
			select: {
				station: {
					select: {
						groupId: true
					}
				}
			}
		});
	});

	const groupIds = new Set<string>();
	for (const { station: { groupId } } of queryResult) {
		if (!groupId) {
			return false;
		}

		groupIds.add(groupId);
		if (groupIds.size > 1) {
			return false;
		}
	}

	return groupIds.size === 1;
}

for (const group of candidates) {
	const name = group.members[0]!.name;
	if (group.type === SearchEntityType.station) {
		console.log('Creating station group:', name);
		await GroupStorageClient.createGroup(name, group.type, group.members.map(member => member.id));
	} else if (group.type === SearchEntityType.menuItem) {
		if (await isSameStation(group.members.map(member => member.id))) {
			console.log(`Creating menu item group ${name} with the same station`);
			await GroupStorageClient.createGroup(name, group.type, group.members.map(member => member.id));
		}
	}
}