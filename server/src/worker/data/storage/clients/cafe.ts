import { Cafe } from '@prisma/client';
import { usePrismaClient, usePrismaWrite } from '../client.js';
import { ICafe, ICafeConfig } from '../../../../shared/models/cafe.js';
import { Lock } from '@frozor/lock';
import type { ICafeRecord, ICafeService } from '../../../../shared/services/cafe.js';

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

export abstract class CafeStorageClient {
	private static _hasInitialized = false;
	private static _cacheLock = new Lock();
    private static readonly _cafeDataById = new Map<string, Cafe>();

    public static resetCache() {
        this._cafeDataById.clear();
		this._hasInitialized = false;
    }

    private static async _ensureCafesExist(): Promise<void> {
		if (this._hasInitialized) {
			return;
		}

		return this._cacheLock.acquire(async () => {
			// We initialized between the first check and acquiring the lock, so we can skip initialization.
			if (this._hasInitialized) {
				return;
			}

			const cafes = await usePrismaClient(prismaClient => prismaClient.cafe.findMany());
			for (const cafe of cafes) {
				this._cafeDataById.set(cafe.id, cafe);
			}

			this._hasInitialized = true;
		});
    }

    public static async retrieveCafeAsync(id: string): Promise<Cafe | undefined> {
        await this._ensureCafesExist();
        return this._cafeDataById.get(id);
    }

    public static async retrieveCafesAsync(): Promise<ReadonlyMap<string, Cafe>> {
        await this._ensureCafesExist();
        return this._cafeDataById;
    }

    public static async doesCafeExistAsync(id: string): Promise<boolean> {
        await this._ensureCafesExist();
        return this._cafeDataById.has(id);
    }

    public static async createCafeAsync(cafe: ICafe, config: ICafeConfig): Promise<void> {
        const cafeWithConfig: Omit<Cafe, 'id'> = {
            name:             cafe.name,
            logoName:         config.logoName || null,
            contextId:        config.contextId,
            tenantId:         config.tenantId,
            displayProfileId: config.displayProfileId,
            storeId:          config.storeId,
            externalName:     config.externalName
        };

        await usePrismaWrite(prismaClient => prismaClient.cafe.upsert({
            where:  { id: cafe.id },
            update: cafeWithConfig,
            create: {
                ...cafeWithConfig,
                id: cafe.id
            }
        }));

        this._cafeDataById.set(cafe.id, {
            ...cafeWithConfig,
            id: cafe.id
        });
    }
}

/**
 * Worker-side implementation of {@link ICafeService}.
 */
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