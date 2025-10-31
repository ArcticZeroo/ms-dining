import { GroupStorageClient } from '../api/storage/clients/groups.js';
import { SearchEntityType } from '@msdining/common/models/search';

console.log('Fetching group candidates without context...');

const candidates = await GroupStorageClient.getGroupCandidatesZeroContext();

console.log('Checking', candidates.length, 'candidates to create default groups...');

for (const group of candidates) {
	const name = group.members[0]!.name;
	if (group.type === SearchEntityType.station) {
		console.log('Creating station group:', name);
		await GroupStorageClient.createGroup(name, group.type, group.members.map(member => member.id));
	} else if (group.type === SearchEntityType.menuItem) {
		const stationNames = new Set<string>();
		for (const member of group.members) {
			const stationName = member.metadata?.stationName;
			if (stationName) {
				stationNames.add(stationName);
			}

			if (stationNames.size > 1) {
				break;
			}
		}

		if (stationNames.size === 1) {
			console.log(`Creating menu item group ${name} with the same station`);
			await GroupStorageClient.createGroup(name, group.type, group.members.map(member => member.id));
		}
	}
}