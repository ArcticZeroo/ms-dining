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

export const getRolesByMenuHash = async (menuHash: string): Promise<IMenuRoleRow[]> => {
    return usePrismaClient(client =>
        client.ingredientsMenuRole.findMany({
            where:  { menuHash },
            select: { menuItemId: true, role: true },
        })
    );
};

export const setRolesForMenuHash = async (menuHash: string, roles: IMenuRoleRow[]): Promise<void> => {
    await usePrismaTransaction(async (tx) => {
        await tx.ingredientsMenuRole.deleteMany({ where: { menuHash } });
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
