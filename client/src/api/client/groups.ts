import {
    CreateGroupResponseSchema,
    GroupDataSchema,
    GroupMemberSchema,
    IAddGroupMembersRequest,
    ICreateGroupRequest,
    ICreateGroupResponse,
    IGroupData,
    IGroupMember,
    IRenameGroupRequest
} from '@msdining/common/models/group';
import { JSON_HEADERS, makeJsonRequestNoParse, makeJsonRequestWithSchema } from '../request.js';
import { z } from 'zod';

const GroupListResponseSchema = z.array(GroupDataSchema);
const GroupMembersResponseSchema = z.array(GroupMemberSchema);

export const retrieveGroupList = async (): Promise<Array<IGroupData>> => {
    return makeJsonRequestWithSchema({
        path: '/api/dining/groups',
        schema: GroupListResponseSchema
    });
}

export const createGroup = async (request: ICreateGroupRequest): Promise<ICreateGroupResponse> => {
    return makeJsonRequestWithSchema({
        path: '/api/dining/groups',
        options: {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify(request)
        },
        schema: CreateGroupResponseSchema
    });
}

export const renameGroup = async (groupId: string, newName: string): Promise<void> => {
    await makeJsonRequestNoParse({
        path: `/api/dining/groups/${groupId}`,
        options: {
            method: 'PATCH',
            headers: JSON_HEADERS,
            body: JSON.stringify({ name: newName } satisfies IRenameGroupRequest)
        }
    });
}

export const deleteGroup = async (groupId: string): Promise<void> => {
    await makeJsonRequestNoParse({
        path: `/api/dining/groups/${groupId}`,
        options: {
            method: 'DELETE'
        }
    });
}

export const deleteGroupMember = async (groupId: string, memberId: string): Promise<void> => {
    await makeJsonRequestNoParse({
        path: `/api/dining/groups/${groupId}/members/${memberId}`,
        options: {
            method: 'DELETE'
        }
    });
}

export const addGroupMembers = async (groupId: string, memberIds: Array<string>): Promise<void> => {
    await makeJsonRequestNoParse({
        path: `/api/dining/groups/${groupId}/members`,
        options: {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ memberIds } satisfies IAddGroupMembersRequest)
        }
    });
}

export const retrieveGroupCandidates = async (groupId: string): Promise<Array<IGroupMember>> => {
    return makeJsonRequestWithSchema({
        path: `/api/dining/groups/${groupId}/candidates`,
        schema: GroupMembersResponseSchema
    });
}

export const retrieveGroupCandidatesZeroContext = async (): Promise<Array<IGroupData>> => {
    return makeJsonRequestWithSchema({
        path: '/api/dining/groups/candidates',
        schema: GroupListResponseSchema
    });
}

export const retrieveItemsWithoutGroup = async (): Promise<Array<IGroupMember>> => {
    return makeJsonRequestWithSchema({
        path: '/api/dining/groups/all-items-without-group',
        schema: GroupMembersResponseSchema
    });
}
