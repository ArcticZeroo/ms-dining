import { allSearchEntityTypes, searchEntityTypeFromString } from './search.js';
import { z } from 'zod';

const allSearchEntityTypesEnum = z.enum(allSearchEntityTypes as [string, ...string[]]).transform(searchEntityTypeFromString);

export const GroupMemberSchema = z.object({
    name: z.string(),
    id: z.string(),
    type: allSearchEntityTypesEnum,
	imageUrl: z.string().optional(),
	metadata: z.record(z.string(), z.string()).optional()
});

export type IGroupMember = z.infer<typeof GroupMemberSchema>;

export const GroupDataSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: allSearchEntityTypesEnum,
    members: z.array(GroupMemberSchema),
	notes: z.string().optional()
});

export type IGroupData = z.infer<typeof GroupDataSchema>;

// Request/Response schemas for API
export const CreateGroupRequestSchema = z.object({
    name: z.string().min(1),
    type: allSearchEntityTypesEnum,
    initialMembers: z.array(z.string()).optional()
});

export type ICreateGroupRequest = z.infer<typeof CreateGroupRequestSchema>;

export const CreateGroupResponseSchema = z.object({
    id: z.string()
});

export type ICreateGroupResponse = z.infer<typeof CreateGroupResponseSchema>;

export const UpdateGroupRequest = z.object({
    name: z.string().optional(),
	notes: z.string().optional()
});

export type IUpdateGroupRequest = z.infer<typeof UpdateGroupRequest>;

export const AddGroupMembersRequestSchema = z.object({
    memberIds: z.array(z.string()).min(1)
});

export type IAddGroupMembersRequest = z.infer<typeof AddGroupMembersRequestSchema>;
