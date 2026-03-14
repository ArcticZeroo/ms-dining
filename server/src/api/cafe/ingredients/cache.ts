import { createHash } from 'crypto';
import { ICafeStation } from '../../../models/cafe.js';
import { usePrismaClient, usePrismaTransaction } from '../../storage/client.js';

export const computeMenuHash = (stations: ICafeStation[]): string => {
    const hash = createHash('md5');

    for (const station of stations) {
        for (const [categoryName, itemIds] of station.menuItemIdsByCategoryName) {
            hash.update(categoryName);
            for (const itemId of itemIds) {
                const item = station.menuItemsById.get(itemId);
                if (item) {
                    hash.update(item.id);
                    hash.update(item.name);
                    hash.update(item.description ?? '');
                    hash.update(String(item.price));
                    for (const modifier of item.modifiers) {
                        hash.update(modifier.description);
                        for (const choice of modifier.choices) {
                            hash.update(choice.description);
                            hash.update(String(choice.price));
                        }
                    }
                }
            }
        }
    }

    return hash.digest('hex');
};

export interface IMenuRoleRow {
    menuItemId: string;
    role: string;
}

export interface IIngredientsMenuData {
    price: number;
    roles: IMenuRoleRow[];
}

export const getIngredientsMenuByHash = async (menuHash: string): Promise<IIngredientsMenuData | null> => {
    return usePrismaClient(async (client) => {
        const metadata = await client.ingredientsMenuMetadata.findUnique({
            where:   { menuHash },
            include: { roles: { select: { menuItemId: true, role: true } } },
        });

        if (metadata == null) {
            return null;
        }

        return {
            price: metadata.price,
            roles: metadata.roles,
        };
    });
};

export const setRolesForMenuHash = async (menuHash: string, roles: IMenuRoleRow[], price: number): Promise<void> => {
    await usePrismaTransaction(async (tx) => {
        await tx.ingredientsMenuRole.deleteMany({ where: { menuHash } });
        await tx.ingredientsMenuMetadata.deleteMany({ where: { menuHash } });
        await tx.ingredientsMenuMetadata.create({ data: { menuHash, price } });
        for (const role of roles) {
            await tx.ingredientsMenuRole.create({
                data: {
                    menuItemId: role.menuItemId,
                    role:       role.role,
                    menuHash,
                },
            });
        }
    });
};
