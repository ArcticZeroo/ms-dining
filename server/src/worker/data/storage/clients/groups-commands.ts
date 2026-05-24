import { SearchEntityType } from '@msdining/common/models/search';
import { IUpdateGroupRequest } from '@msdining/common/models/group';
import type { IGroupsService } from '../../../../shared/services/groups.js';
import { GroupStorageClient } from './groups.js';

export const groupsServiceCommands = {
    getGroups: async (_data: {}) =>
        GroupStorageClient.getGroups(),
    getGroupCandidatesZeroContext: async (_data: {}) =>
        GroupStorageClient.getGroupCandidatesZeroContext(),
    getCandidatesForGroup: async ({ groupId }: { groupId: string }) =>
        GroupStorageClient.getCandidatesForGroup(groupId),
    getGroupMembers: async ({ groupId }: { groupId: string }) =>
        GroupStorageClient.getGroupMembers(groupId),
    createGroup: async ({ name, entityType, initialMembers }: { name: string; entityType: SearchEntityType; initialMembers?: string[] }) => {
        const group = await GroupStorageClient.createGroup(name, entityType, initialMembers);
        return { id: group.id };
    },
    updateGroup: async ({ id, update }: { id: string; update: IUpdateGroupRequest }) => {
        await GroupStorageClient.updateGroup(id, update);
    },
    deleteGroup: async ({ id }: { id: string }) => {
        await GroupStorageClient.deleteGroup(id);
    },
    addToGroup: async ({ groupId, memberIds }: { groupId: string; memberIds: string[] }) => {
        await GroupStorageClient.addToGroup(groupId, memberIds);
    },
    deleteMembersFromGroup: async ({ groupId, memberIds }: { groupId: string; memberIds: string[] }) => {
        await GroupStorageClient.deleteMembersFromGroup(groupId, memberIds);
    },
} satisfies IGroupsService;
