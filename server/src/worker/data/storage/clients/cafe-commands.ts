import type { Cafe } from '@prisma/client';
import type { ICafe, ICafeConfig } from '../../../../shared/models/cafe.js';
import type { ICafeRecord, ICafeService } from '../../../../shared/services/cafe.js';
import { CafeStorageClient } from './cafe.js';

const toCafeRecord = (cafe: Cafe): ICafeRecord => ({
    id:               cafe.id,
    name:             cafe.name,
    tenantId:         cafe.tenantId,
    logoName:         cafe.logoName,
    contextId:        cafe.contextId,
    displayProfileId: cafe.displayProfileId,
    storeId:          cafe.storeId,
    externalName:     cafe.externalName,
});

export const cafeServiceCommands = {
    retrieveCafe: async ({ id }: { id: string }) => {
        const cafe = await CafeStorageClient.retrieveCafeAsync(id);
        return cafe ? toCafeRecord(cafe) : null;
    },
    retrieveCafes: async (_data: {}) => {
        const map = await CafeStorageClient.retrieveCafesAsync();
        const result: Record<string, ICafeRecord> = {};
        for (const [id, cafe] of map) {
            result[id] = toCafeRecord(cafe);
        }
        return result;
    },
    doesCafeExist: async ({ id }: { id: string }) =>
        CafeStorageClient.doesCafeExistAsync(id),
    createCafe: async ({ cafe, config }: { cafe: ICafe; config: ICafeConfig }) =>
        CafeStorageClient.createCafeAsync(cafe, config),
    resetCache: async (_data: {}) =>
        CafeStorageClient.resetCache(),
} satisfies ICafeService;
