import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import * as GroupClient from '../api/client/groups.js';
import { getRandomId } from '../util/id.ts';
import { LazyResource } from './lazy.js';
import { SearchEntityType } from '@msdining/common/models/search';

const resourceFactory = {
    async groups(): Promise<Map<string, IGroupData>> {
        const list = await GroupClient.retrieveGroupList();
        return new Map<string, IGroupData>(list.map((group) => [group.id, group]));
    },
    async zeroContextCandidates(): Promise<Map<string, IGroupData>> {
        const list = await GroupClient.retrieveGroupCandidatesZeroContext();
        return new Map<string, IGroupData>(list.map((group) => [group.id, group]));
    },
    async allItemsWithoutGroup(): Promise<Map<SearchEntityType, Map<string /*id*/, IGroupMember>>> {
        const itemsWithoutGroup = await GroupClient.retrieveItemsWithoutGroup();
        const map = new Map<SearchEntityType, Map<string, IGroupMember>>();

        for (const item of itemsWithoutGroup) {
            if (!map.has(item.type)) {
                map.set(item.type, new Map<string, IGroupMember>());
            }

            map.get(item.type)!.set(item.id, item);
        }

        return map;
    }
};

const cloneAllItemsWithoutGroup = (original: Map<SearchEntityType, Map<string, IGroupMember>>): Map<SearchEntityType, Map<string, IGroupMember>> => {
    return new Map<SearchEntityType, Map<string, IGroupMember>>(
        Array.from(original.entries())
            .map(([entityType, itemsById]) => [entityType, new Map<string, IGroupMember>(itemsById)])
    );
};

class GroupStore {
    private _groups = new LazyResource(resourceFactory.groups);
    private _zeroContextCandidates = new LazyResource(resourceFactory.zeroContextCandidates);
    private _allItemsWithoutGroup = new LazyResource(resourceFactory.allItemsWithoutGroup);

    get groups() {
        return this._groups.get();
    }

    get zeroContextCandidates() {
        return this._zeroContextCandidates.get();
    }

    get allItemsWithoutGroup() {
        return this._allItemsWithoutGroup.get();
    }

    refreshGroups() {
        this._groups.get(true /*forceRefresh*/);
    }

    async renameGroup(groupId: string, newName: string) {
        await GroupClient.renameGroup(groupId, newName);
        await this._groups.updateExisting((current) => {
            const updatedMap = new Map<string, IGroupData>(current);
            const group = updatedMap.get(groupId);
            if (group) {
                updatedMap.set(groupId, { ...group, name: newName });
                return updatedMap;
            }
            return current;
        });
    }

    async deleteGroup(groupId: string) {
        await GroupClient.deleteGroup(groupId);
        await this._groups.updateExisting(async (current) => {
            const updatedMap = new Map<string, IGroupData>(current);

            const group = updatedMap.get(groupId);
            if (group) {
                await this._allItemsWithoutGroup.updateExisting((currentItems) => {
                    const newItemsWithoutGroup = cloneAllItemsWithoutGroup(currentItems);
                    for (const member of group.members) {
                        if (!newItemsWithoutGroup.has(member.type)) {
                            newItemsWithoutGroup.set(member.type, new Map<string, IGroupMember>());
                        }
                        newItemsWithoutGroup.get(member.type)!.set(member.id, member);
                    }
                    return newItemsWithoutGroup;
                });
            }

            updatedMap.delete(groupId);
            return updatedMap;
        });
    }

    async #removeFromAllItemsWithoutGroup(members: IGroupMember[]) {
        await this._allItemsWithoutGroup.updateExisting((currentItems) => {
            const newItemsWithoutGroup = cloneAllItemsWithoutGroup(currentItems);
            for (const member of members) {
                const itemsById = newItemsWithoutGroup.get(member.type);
                if (itemsById) {
                    itemsById.delete(member.id);
                }
            }
            return newItemsWithoutGroup;
        });
    }

    async addGroupMembers(groupId: string, members: IGroupMember[]) {
        const memberIds = new Set(members.map(member => member.id));
        await GroupClient.addGroupMembers(groupId, Array.from(memberIds));

        await this._groups.updateExisting((current) => {
            const updatedMap = new Map<string, IGroupData>(current);
            const group = updatedMap.get(groupId);
            if (group) {
                updatedMap.set(groupId, {
                    ...group,
                    members: [...group.members.filter(member => !memberIds.has(member.id)), ...members]
                });
                return updatedMap;
            }
            return current;
        });

        await this.#removeFromAllItemsWithoutGroup(members);
    }

    async acceptCandidateMembers(candidate: IGroupData, memberIds: ReadonlySet<string>) {
        const { id } = await GroupClient.createGroup({
            name: candidate.name,
            type: candidate.type,
            initialMembers: Array.from(memberIds)
        });

        const newGroupMembers: IGroupMember[] = [];
        const newCandidateMembers: IGroupMember[] = [];
        for (const member of candidate.members) {
            if (memberIds.has(member.id)) {
                newGroupMembers.push(member);
            } else {
                newCandidateMembers.push(member);
            }
        }

        await this._zeroContextCandidates.updateExisting((currentZeroContextCandidates) => {
            const updatedCandidates = new Map<string, IGroupData>(currentZeroContextCandidates);
            updatedCandidates.delete(candidate.id);
            if (newCandidateMembers.length > 0) {
                // Create a new candidate with the remaining members - they would make up a new group if accepted
                const newId = getRandomId();
                updatedCandidates.set(newId, { ...candidate, id: newId, members: newCandidateMembers });
            }
            return updatedCandidates;
        });

        await this._groups.updateExisting((currentGroups) => {
            const updatedGroups = new Map<string, IGroupData>(currentGroups);
            updatedGroups.set(id, { ...candidate, id, members: newGroupMembers });
            return updatedGroups;
        });

        await this.#removeFromAllItemsWithoutGroup(newGroupMembers);
    }
}

export const GROUP_STORE = new GroupStore();