import { Cafe } from '@prisma/client';
import { usePrismaClient } from '../client.js';
import { ICafe, ICafeConfig } from '../../../models/cafe.js';

export abstract class CafeStorageClient {
    private static readonly _cafeDataById = new Map<string, Cafe>();
    private static readonly _tagNamesById = new Map<string, string>();

    public static resetCache() {
        this._cafeDataById.clear();
        this._tagNamesById.clear();
    }

    private static async _ensureCafesExist(): Promise<void> {
        if (this._cafeDataById.size > 0) {
            return;
        }

        const cafes = await usePrismaClient(prismaClient => prismaClient.cafe.findMany());
        for (const cafe of cafes) {
            this._cafeDataById.set(cafe.id, cafe);
        }
    }

    public static async retrieveCafeAsync(id: string): Promise<Cafe | undefined> {
        await this._ensureCafesExist();
        return this._cafeDataById.get(id);
    }

    public static async retrieveCafesAsync(): Promise<ReadonlyMap<string, Cafe>> {
        await this._ensureCafesExist();
        return this._cafeDataById;
    }

    public static async createCafeAsync(cafe: ICafe, config: ICafeConfig): Promise<void> {
        const cafeWithConfig: Omit<Cafe, 'id'> = {
            name:             cafe.name,
            logoName:         config.logoName,
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

    public static async deleteCafe(cafeId: string): Promise<void> {
        // This is going to be slower but hopefully this rarely ever happens anyway
        await usePrismaClient(client => client.cafe.deleteMany({
            where: { id: cafeId },
        }));
        this._cafeDataById.delete(cafeId);
    }
}