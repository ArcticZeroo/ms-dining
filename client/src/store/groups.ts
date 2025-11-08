import { IGroupData, IGroupMember, IUpdateGroupRequest } from '@msdining/common/models/group';
import * as GroupClient from '../api/client/groups.js';
import { getRandomId } from '../util/id.ts';
import { LazyResource } from './lazy.js';
import { SearchEntityType } from '@msdining/common/models/search';
import { ValueNotifier } from '../util/events.js';

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
    readonly #groups = new LazyResource(resourceFactory.groups);
    readonly #zeroContextCandidates = new LazyResource(resourceFactory.zeroContextCandidates);
    readonly #allItemsWithoutGroup = new LazyResource(resourceFactory.allItemsWithoutGroup);
    readonly #allItemsWithoutGroupByNormalizedName = new ValueNotifier<Map<string /*groupId*/, Array<IGroupMember>>>(new Map());

    constructor() {
        this.#allItemsWithoutGroup.addLazyListener(({ value: allItemsWithoutGroup }) => {
            if (!allItemsWithoutGroup) {
                if (this.#allItemsWithoutGroupByNormalizedName.value.size > 0) {
                    this.#allItemsWithoutGroupByNormalizedName.value = new Map();
                }
                return;
            }

            const allItemsByNormalizedName = new Map<string /*normalizedName*/, Array<IGroupMember>>();
            for (const itemsById of allItemsWithoutGroup.values()) {
                for (const item of itemsById.values()) {
                    const normalizedName = item.name.toLowerCase();
                    if (!allItemsByNormalizedName.has(normalizedName)) {
                        allItemsByNormalizedName.set(normalizedName, []);
                    }
                    allItemsByNormalizedName.get(normalizedName)!.push(item);
                }
            }

            this.#allItemsWithoutGroupByNormalizedName.value = allItemsByNormalizedName;
        });
    }

    get groups() {
        return this.#groups.get();
    }

    get zeroContextCandidates() {
        return this.#zeroContextCandidates.get();
    }

    get allItemsWithoutGroup() {
        return this.#allItemsWithoutGroup.get();
    }

    get allItemsWithoutGroupByNormalizedName() {
        this.#allItemsWithoutGroup.get();
        return this.#allItemsWithoutGroupByNormalizedName;
    }

    refreshGroups() {
        this.#groups.get(true /*forceRefresh*/);
    }

    async updateGroup(groupId: string, { name, notes }: IUpdateGroupRequest) {
        await GroupClient.updateGroup(groupId, { name, notes });
        await this.#groups.updateExisting((current) => {
            const updatedMap = new Map<string, IGroupData>(current);
            const group = updatedMap.get(groupId);
            if (group) {
                const newGroup = { ...group };

                if (name != null) {
                    newGroup.name = name;
                }

                if (notes != null) {
                    newGroup.notes = notes;
                }

                updatedMap.set(groupId, newGroup);
                return updatedMap;
            }
            return current;
        });
    }

    async deleteGroupMember(groupId: string, memberId: string) {
        await GroupClient.deleteGroupMember(groupId, memberId);

        const removedMembers: IGroupMember[] = [];
        const remainingMembers: IGroupMember[] = [];

        await this.#groups.updateExisting(async (current) => {
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

        await this.#onItemsRemovedFromGroup(removedMembers);
    }

    async deleteGroup(groupId: string) {
        await GroupClient.deleteGroup(groupId);

        await this.#groups.updateExisting(async (current) => {
            const updatedMap = new Map<string, IGroupData>(current);

            const group = updatedMap.get(groupId);
            if (group) {
                await this.#onItemsRemovedFromGroup(group.members);
            }

            updatedMap.delete(groupId);
            return updatedMap;
        });
    }

    async #onItemsAssignedToGroup(members: IGroupMember[]) {
        await this.#zeroContextCandidates.updateExisting((currentZeroContextCandidates) => {
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

        await this.#allItemsWithoutGroup.updateExisting((currentItems) => {
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

    async #onItemsRemovedFromGroup(removedMembers: IGroupMember[]) {
        await this.#allItemsWithoutGroup.updateExisting((currentItems) => {
            const newItemsWithoutGroup = cloneAllItemsWithoutGroup(currentItems);
            for (const member of removedMembers) {
                if (!newItemsWithoutGroup.has(member.type)) {
                    newItemsWithoutGroup.set(member.type, new Map<string, IGroupMember>());
                }
                newItemsWithoutGroup.get(member.type)!.set(member.id, member);
            }
            return newItemsWithoutGroup;
        });
    }

    async addGroupMembers(groupId: string, members: IGroupMember[]) {
        const memberIds = new Set(members.map(member => member.id));
        await GroupClient.addGroupMembers(groupId, Array.from(memberIds));

        await this.#groups.updateExisting((current) => {
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

        await this.#onItemsAssignedToGroup(members);
    }

    async createGroup(name: string, type: SearchEntityType, initialMembers: Array<IGroupMember>) {
        const memberIds = new Set(initialMembers.map(member => member.id));
        const { id } =  await GroupClient.createGroup({
            name,
            type,
            initialMembers: Array.from(memberIds)
        });

        await this.#groups.updateExisting((current) => {
            const updatedMap = new Map<string, IGroupData>(current);
            updatedMap.set(id, {
                id,
                name,
                type,
                members: initialMembers
            });
            return updatedMap;
        });

        await this.#onItemsAssignedToGroup(initialMembers);
    }

    async acceptCandidateMembers(candidate: IGroupData, memberIds: ReadonlySet<string>) {
        const { id } = await GroupClient.createGroup({
            name:           candidate.name,
            type:           candidate.type,
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

        await this.#zeroContextCandidates.updateExisting((currentZeroContextCandidates) => {
            const updatedCandidates = new Map<string, IGroupData>(currentZeroContextCandidates);
            updatedCandidates.delete(candidate.id);
            if (newCandidateMembers.length > 0) {
                // Create a new candidate with the remaining members - they would make up a new group if accepted
                const newId = getRandomId();
                updatedCandidates.set(newId, { ...candidate, id: newId, members: newCandidateMembers });
            }
            return updatedCandidates;
        });

        await this.#groups.updateExisting((currentGroups) => {
            const updatedGroups = new Map<string, IGroupData>(currentGroups);
            updatedGroups.set(id, { ...candidate, id, members: newGroupMembers });
            return updatedGroups;
        });

        await this.#onItemsAssignedToGroup(newGroupMembers);
    }
}

export const GROUP_STORE = new GroupStore();