import { isDuckType } from '@arcticzeroo/typeguard';
import { IDiningHallConfigResponse } from '../models/responses.js';

export const isDiningHallConfigResponse = (value: unknown): value is IDiningHallConfigResponse => isDuckType<IDiningHallConfigResponse>(value, {
    tenantId: 'string',
    contextId: 'string',
    theme: 'object',
    storeList: 'object'
});