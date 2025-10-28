import { IGroupData, IGroupMember } from '@msdining/common/models/group';
import {
    createGroup,
    deleteGroup, renameGroup,
    retrieveGroupCandidatesZeroContext,
    retrieveGroupList
} from '../api/client/groups.js';
import { ValueNotifier } from '../util/events.js';
import { getRandomId } from '../util/id.ts';
import { ILazyPromiseState, LazyResource } from './lazy.js';

const resourceFactory = {
    async groups(): Promise<Map<string, IGroupData>> {
        const list = await retrieveGroupList();
        return new Map<string, IGroupData>(list.map((group) => [group.id, group]));
    },
    async zeroContextCandidates(): Promise<Map<string, IGroupData>> {
        const list = await retrieveGroupCandidatesZeroContext();
        return new Map<string, IGroupData>(list.map((group) => [group.id, group]));
    }
}

class GroupStore {
    private _groups = new LazyResource<Map<string, IGroupData>>(resourceFactory.groups);
    private _zeroContextCandidates = new LazyResource<Map<string, IGroupData>>(resourceFactory.zeroContextCandidates);

    get groups(): ValueNotifier<ILazyPromiseState<Map<string, IGroupData>>> {
        return this._groups.get();
    }

    get zeroContextCandidates(): ValueNotifier<ILazyPromiseState<Map<string, IGroupData>>> {
        return this._zeroContextCandidates.get();
    }

    refreshGroups() {
        this._groups.get(true /*forceRefresh*/);
    }

    async renameGroup(groupId: string, newName: string) {
        await renameGroup(groupId, newName);
        await this._groups.update((current) => {
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
        await deleteGroup(groupId);
        await this._groups.update((current) => {
            const updatedMap = new Map<string, IGroupData>(current);
            updatedMap.delete(groupId);
            return updatedMap;
        });
    }

    async acceptCandidateMembers(candidate: IGroupData, memberIds: ReadonlySet<string>) {
        const { id } = await createGroup({
            name: candidate.name,
            type: candidate.type,
            initialMembers: Array.from(memberIds)
        });

        const zeroContextCandidates = await this.zeroContextCandidates.value.promise;
        const groups = await this.groups.value.promise;

        const newGroupMembers: IGroupMember[] = [];
        const newCandidateMembers: IGroupMember[] = [];
        for (const member of candidate.members) {
            if (memberIds.has(member.id)) {
                newGroupMembers.push(member);
            } else {
                newCandidateMembers.push(member);
            }
        }

        const updatedCandidates = new Map<string, IGroupData>(zeroContextCandidates);
        updatedCandidates.delete(candidate.id);
        if (newCandidateMembers.length > 0) {
            // Create a new candidate with the remaining members - they would make up a new group if accepted
            const newId = getRandomId();
            updatedCandidates.set(newId, { ...candidate, id: newId, members: newCandidateMembers });
        }
        this._zeroContextCandidates.set(updatedCandidates);

        const updatedGroups = new Map<string, IGroupData>(groups);
        updatedGroups.set(id, { ...candidate, id, members: newGroupMembers });
        this._groups.set(updatedGroups);
    }
}

export const GROUP_STORE = new GroupStore();