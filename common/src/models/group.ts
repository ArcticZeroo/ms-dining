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
    members: z.array(GroupMemberSchema)
})

export type IGroupData = z.infer<typeof GroupDataSchema>;

// Request/Response schemas for API
export const CreateGroupRequestSchema = z.object({
    name: z.string().min(1),
    entityType: allSearchEntityTypesEnum,
    initialMembers: z.array(z.string()).optional()
});

export type ICreateGroupRequest = z.infer<typeof CreateGroupRequestSchema>;

export const CreateGroupResponseSchema = z.object({
    id: z.string()
});

export type ICreateGroupResponse = z.infer<typeof CreateGroupResponseSchema>;

export const RenameGroupRequestSchema = z.object({
    name: z.string().min(1)
});

export type IRenameGroupRequest = z.infer<typeof RenameGroupRequestSchema>;

export const AddGroupMembersRequestSchema = z.object({
    memberIds: z.array(z.string()).min(1)
});

export type IAddGroupMembersRequest = z.infer<typeof AddGroupMembersRequestSchema>;
