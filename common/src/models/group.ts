import { SearchEntityType } from './search.js';
import { z } from 'zod';

export const GroupMemberSchema = z.object({
    name: z.string(),
    id: z.string(),
    type: z.enum(SearchEntityType),
});

export type IGroupMember = z.infer<typeof GroupMemberSchema>;

export const GroupDataSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(SearchEntityType),
    members: z.array(GroupMemberSchema)
})

export type IGroupData = z.infer<typeof GroupDataSchema>;
