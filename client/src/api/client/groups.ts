import { IGroupData, GroupDataSchema } from '@msdining/common/models/group';
import { makeJsonRequest } from '../request.js';
import { z } from 'zod';

const GroupListResponseSchema = z.array(GroupDataSchema);

export const retrieveGroupList = async (): Promise<Array<IGroupData>> => {
    const result = await makeJsonRequest({
        path: '/api/dining/groups',
    });

    return GroupListResponseSchema.parse(result);
}