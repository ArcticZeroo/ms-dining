import { GroupDataSchema, IGroupData } from '@msdining/common/models/group';
import { makeJsonRequestWithSchema } from '../request.js';
import { z } from 'zod';

const GroupListResponseSchema = z.array(GroupDataSchema);

export const retrieveGroupList = async (): Promise<Array<IGroupData>> => {
    return makeJsonRequestWithSchema({
        path: '/api/dining/groups',
        schema: GroupListResponseSchema
    });
}