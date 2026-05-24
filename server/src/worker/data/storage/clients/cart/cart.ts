import { usePrismaClient, usePrismaTransaction } from '../../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../../rpc/errors.js';
import { MenuItemStorageClient } from '../menu-item/menu-item.js';
import { toDateString } from '@msdining/common/util/date-util';
import type { PrismaTransactionClient } from '../../../../../shared/models/prisma.js';
import type {
    ICartItemData,
    ICartItemRecord,
    ICartItemUpdate,
    ISerializedModifier,
} from '@msdining/common/models/cart';
import type { IMenuItemBase } from '@msdining/common/models/cafe';

type PrismaCartItemWithModifiers = {
    id: string;
    menuItemId: string;
    quantity: number;
    specialInstructions: string | null;
    createdAt: Date;
    updatedAt: Date;
    modifierChoices: { modifierId: string; choiceId: string }[];
};

const groupModifierChoices = (choices: { modifierId: string; choiceId: string }[]): ISerializedModifier[] => {
    const byModifier = new Map<string, string[]>();
    for (const { modifierId, choiceId } of choices) {
        const existing = byModifier.get(modifierId);
        if (existing) {
            existing.push(choiceId);
        } else {
            byModifier.set(modifierId, [choiceId]);
        }
    }
    return Array.from(byModifier, ([modifierId, choiceIds]) => ({ modifierId, choiceIds }));
};

const toCartItemRecord = (
    item: PrismaCartItemWithModifiers,
    menuItem: IMenuItemBase,
    isAvailable: boolean,
): ICartItemRecord => ({
    id:                  item.id,
    menuItemId:          item.menuItemId,
    quantity:            item.quantity,
    specialInstructions: item.specialInstructions,
    modifiers:           groupModifierChoices(item.modifierChoices),
    createdAt:           item.createdAt.toISOString(),
    updatedAt:           item.updatedAt.toISOString(),
    menuItem,
    isAvailable,
});

const CART_ITEM_INCLUDE = {
    modifierChoices: {
        select: { modifierId: true, choiceId: true },
    },
} as const;

export abstract class CartStorageClient {
    private static async getAvailableMenuItemIds(menuItemIds: string[]): Promise<Set<string>> {
        if (menuItemIds.length === 0) {
            return new Set();
        }

        const todayString = toDateString(new Date());

        const availableRows = await usePrismaClient(prisma => prisma.dailyMenuItem.findMany({
            where: {
                menuItemId: { in: menuItemIds },
                category: {
                    station: {
                        dailyCafe: {
                            dateString: todayString,
                        },
                    },
                },
            },
            select: { menuItemId: true },
            distinct: ['menuItemId'],
        }));

        return new Set(availableRows.map(r => r.menuItemId));
    }

    private static async readRawCartData(tx: PrismaTransactionClient, userId: string) {
        const cart = await tx.cart.findUnique({
            where:   { userId },
            include: { items: { include: CART_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } } },
        });
        return { items: cart?.items ?? [] };
    }

    private static async enrichCartResponse(
        rawItems: Awaited<ReturnType<typeof CartStorageClient.readRawCartData>>['items'],
    ) {
        if (rawItems.length === 0) {
            return { items: [] };
        }

        const menuItemIds = rawItems.map(i => i.menuItemId);
        const [availableIds, ...menuItems] = await Promise.all([
            this.getAvailableMenuItemIds(menuItemIds),
            ...menuItemIds.map(id => MenuItemStorageClient.retrieveMenuItemAsync(id)),
        ]);

        const items: ICartItemRecord[] = [];
        for (let i = 0; i < rawItems.length; i++) {
            const raw = rawItems[i]!;
            const menuItem = menuItems[i];
            if (!menuItem) {
                continue;
            }
            items.push(toCartItemRecord(raw, menuItem, availableIds.has(raw.menuItemId)));
        }

        return { items };
    }

    private static readonly CART_WITH_ITEMS_INCLUDE = {
        items: { include: CART_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } as const },
    };

    private static async getOrCreateCart(tx: PrismaTransactionClient, userId: string) {
        return tx.cart.upsert({
            where:   { userId },
            create:  { userId },
            update:  {},
            include: this.CART_WITH_ITEMS_INCLUDE,
        });
    }

    private static async useCartTransaction(
        userId: string,
        callback: (tx: PrismaTransactionClient, cart: Awaited<ReturnType<typeof CartStorageClient.getOrCreateCart>>) => Promise<void>,
    ) {
        const rawData = await usePrismaTransaction(async tx => {
            const cart = await this.getOrCreateCart(tx, userId);
            await callback(tx, cart);
            return this.readRawCartData(tx, userId);
        });
        return this.enrichCartResponse(rawData.items);
    }

    private static async createModifierChoices(
        tx: PrismaTransactionClient,
        cartItemId: string,
        modifiers: ISerializedModifier[],
    ): Promise<void> {
        const rows = modifiers.flatMap(mod =>
            mod.choiceIds.map(choiceId => ({
                cartItemId,
                modifierId: mod.modifierId,
                choiceId,
            })),
        );
        if (rows.length > 0) {
            await tx.cartItemModifierChoice.createMany({ data: rows });
        }
    }

    static async getCart(userId: string) {
        return this.useCartTransaction(userId, async () => {});
    }

    static async addItems(userId: string, items: ICartItemData[]) {
        return this.useCartTransaction(userId, async (tx, cart) => {
            for (const item of items) {
                const created = await tx.cartItem.create({
                    data: {
                        cartUserId:          cart.userId,
                        menuItemId:          item.menuItemId,
                        quantity:            item.quantity,
                        specialInstructions: item.specialInstructions ?? null,
                    },
                });
                await this.createModifierChoices(tx, created.id, item.modifiers);
            }
        });
    }

    static async updateItem(userId: string, itemId: string, update: ICartItemUpdate) {
        return this.useCartTransaction(userId, async (tx, cart) => {
            if (!cart.items.some(i => i.id === itemId)) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cart item ${itemId} not found`);
            }

            await tx.cartItem.update({
                where: { id: itemId },
                data:  {
                    quantity:            update.quantity,
                    specialInstructions: update.specialInstructions,
                },
            });

            await tx.cartItemModifierChoice.deleteMany({ where: { cartItemId: itemId } });
            await this.createModifierChoices(tx, itemId, update.modifiers);
        });
    }

    static async removeItem(userId: string, itemId: string) {
        return this.useCartTransaction(userId, async (tx, cart) => {
            if (!cart.items.some(i => i.id === itemId)) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cart item ${itemId} not found`);
            }
            await tx.cartItem.delete({ where: { id: itemId } });
        });
    }

    static async clearCart(userId: string) {
        return this.useCartTransaction(userId, async (tx, cart) => {
            await tx.cartItem.deleteMany({ where: { cartUserId: cart.userId } });
        });
    }
}

