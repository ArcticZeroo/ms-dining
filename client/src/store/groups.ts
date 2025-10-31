import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import * as GroupClient from '../api/client/groups.js';
import { getRandomId } from '../util/id.ts';
import { LazyResource } from './lazy.js';
import { SearchEntityType } from '@msdining/common/models/search';
import { normalizeNameForSearch } from '@msdining/common/util/search-util';

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
    private _candidatesForExistingGroups = new Map<string /*groupId*/, LazyResource<Array<IGroupMember>>>();

    get groups() {
        return this._groups.get();
    }

    get zeroContextCandidates() {
        return this._zeroContextCandidates.get();
    }

    get allItemsWithoutGroup() {
        return this._allItemsWithoutGroup.get();
    }

    getCandidatesForExistingGroup(groupId: string) {
        if (!this._candidatesForExistingGroups.has(groupId)) {
            this._candidatesForExistingGroups.set(
                groupId,
                new LazyResource(() => GroupClient.retrieveCandidatesForExistingGroup(groupId))
            );
        }

        return this._candidatesForExistingGroups.get(groupId)!.get();
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

    async deleteGroupMember(groupId: string, memberId: string) {
        await GroupClient.deleteGroupMember(groupId, memberId);

        const removedMembers: IGroupMember[] = [];
        const remainingMembers: IGroupMember[] = [];

        await this._groups.updateExisting(async (current) => {
            const updatedMap = new Map<string, IGroupData>(current);
            const group = updatedMap.get(groupId);
            if (group) {
                for (const member of group.members) {
                    if (memberId === member.id) {
                        removedMembers.push(member);
                    } else {
                        remainingMembers.push(member);
                    }
                }
                updatedMap.set(groupId, { ...group, members: remainingMembers });

                return updatedMap;
            }
            return current;
        });

        await this.#onItemsRemovedFromGroup(groupId, removedMembers, remainingMembers);
    }

    async deleteGroup(groupId: string) {
        await GroupClient.deleteGroup(groupId);

        this._candidatesForExistingGroups.delete(groupId);

        await this._groups.updateExisting(async (current) => {
            const updatedMap = new Map<string, IGroupData>(current);

            const group = updatedMap.get(groupId);
            if (group) {
                await this.#onItemsRemovedFromGroup(group.id, group.members, [] /*remainingMembers*/);
            }

            updatedMap.delete(groupId);
            return updatedMap;
        });
    }

    async #onItemsAssignedToGroup(groupId: string, members: IGroupMember[]) {
        await this._zeroContextCandidates.updateExisting((currentZeroContextCandidates) => {
            const updatedCandidates = new Map<string, IGroupData>(currentZeroContextCandidates);

            let didAnythingChange = false;
            for (const [candidateId, candidate] of currentZeroContextCandidates.entries()) {
                const newMembers = candidate.members.filter(member => !members.some(addedMember => addedMember.id === member.id));
                if (newMembers.length === 0) {
                    didAnythingChange = true;
                    updatedCandidates.delete(candidateId);
                } else if (newMembers.length < candidate.members.length) {
                    didAnythingChange = true;
                    updatedCandidates.set(candidateId, { ...candidate, members: newMembers });
                }
            }

            if (didAnythingChange) {
                return updatedCandidates;
            }

            return currentZeroContextCandidates;
        });

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

        const groupMemberSuggestions = this._candidatesForExistingGroups.get(groupId);
        if (groupMemberSuggestions) {
            await groupMemberSuggestions.updateExisting((currentMembers) => {
                return currentMembers.filter(member => !members.some(addedMember => addedMember.id === member.id));
            });
        }
    }

    async #onItemsRemovedFromGroup(groupId: string, removedMembers: IGroupMember[], remainingMembers: IGroupMember[]) {
        await this._allItemsWithoutGroup.updateExisting((currentItems) => {
            const newItemsWithoutGroup = cloneAllItemsWithoutGroup(currentItems);
            for (const member of removedMembers) {
                if (!newItemsWithoutGroup.has(member.type)) {
                    newItemsWithoutGroup.set(member.type, new Map<string, IGroupMember>());
                }
                newItemsWithoutGroup.get(member.type)!.set(member.id, member);
            }
            return newItemsWithoutGroup;
        });

        const groupMemberSuggestions = this._candidatesForExistingGroups.get(groupId);
        if (groupMemberSuggestions && remainingMembers.length > 0) {
            const suggestionsToAdd = removedMembers.filter((removedMember) => {
                const removedMemberName = normalizeNameForSearch(removedMember.name);
                return remainingMembers.some((remainingMember) => normalizeNameForSearch(remainingMember.name) === removedMemberName);
            });

            await groupMemberSuggestions.updateExisting((currentMembers) => {
                return [...currentMembers, ...suggestionsToAdd];
            });
        }
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

        await this.#onItemsAssignedToGroup(groupId, members);
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

        await this.#onItemsAssignedToGroup(id, newGroupMembers);
    }
}

export const GROUP_STORE = new GroupStore();