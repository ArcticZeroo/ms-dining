import type {
    IGroupData,
    IGroupMember,
    IUpdateGroupRequest,
} from '@msdining/common/models/group';
import type { SearchEntityType } from '@msdining/common/models/search';

export interface IGroupsService {
    getGroups(data: {}): Promise<IGroupData[]>;
    getGroupCandidatesZeroContext(data: {}): Promise<IGroupData[]>;
    getCandidatesForGroup(data: { groupId: string }): Promise<IGroupMember[]>;
    getGroupMembers(data: { groupId: string }): Promise<IGroupMember[]>;
    createGroup(data: { name: string; entityType: SearchEntityType; initialMembers?: string[] }): Promise<{ id: string }>;
    updateGroup(data: { id: string; update: IUpdateGroupRequest }): Promise<void>;
    deleteGroup(data: { id: string }): Promise<void>;
    addToGroup(data: { groupId: string; memberIds: string[] }): Promise<void>;
    deleteMembersFromGroup(data: { groupId: string; memberIds: string[] }): Promise<void>;
}
