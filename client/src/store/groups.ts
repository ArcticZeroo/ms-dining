import { IGroupData } from '@msdining/common/models/group';
import { LazyResource } from './lazy.js';
import { createGroup, retrieveGroupList } from '../api/client/groups.js';
import { ValueNotifierMap } from '../util/events.js';

const retrieveGroupsAsync = async (): Promise<ValueNotifierMap<string, IGroupData>> => {
    const list = await retrieveGroupList();
    const map = new Map<string, IGroupData>(list.map((group) => [group.id, group]));
    return new ValueNotifierMap(map);
}

class GroupStore {
    private _groups = new LazyResource<ValueNotifierMap<string, IGroupData>>(retrieveGroupsAsync);

    async getGroupsAsync(): Promise<ValueNotifierMap<string, IGroupData>> {
        return this._groups.get();
    }

    async convertCandidateToGroup(candidate: IGroupData, initialMemberIds: Set<string>) {
        const { id } = await createGroup({
            name: candidate.name,
            type: candidate.type,
            initialMembers: Array.from(initialMemberIds)
        });

        const groups = await this.getGroupsAsync();
        groups.set(candidate.id, {
            ...candidate,
            id
        });
    }
}

export const GROUP_STORE = new GroupStore();