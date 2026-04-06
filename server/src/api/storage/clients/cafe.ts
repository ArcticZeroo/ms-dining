import { Cafe } from '@prisma/client';
import { usePrismaClient } from '../client.js';
import { ICafe, ICafeConfig } from '../../../models/cafe.js';
import { Lock } from '@frozor/lock';

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

        await usePrismaClient(prismaClient => prismaClient.cafe.upsert({
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