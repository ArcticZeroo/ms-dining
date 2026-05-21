import { usePrismaClient, usePrismaTransaction, usePrismaWrite } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import type { PrismaTransactionClient } from '../../../../shared/models/prisma.js';
import type { ICartService } from '../../../../shared/services/cart.js';
import type {
    ICartItemData,
    ICartItemUpdate,
    ICartItemRecord,
    ICartResponse,
    ISerializedModifier,
    IActiveOrderSummary,
    IOrderCafePartSummary,
    OrderCafePartStatus,
} from '@msdining/common/models/cart';
import { ACTIVE_ORDER_CAFE_PART_STATUSES } from '@msdining/common/models/cart';

// ─── Helpers ─────────────────────────────────────────────────────────

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

const toCartItemRecord = (item: PrismaCartItemWithModifiers): ICartItemRecord => ({
    id:                  item.id,
    menuItemId:          item.menuItemId,
    quantity:            item.quantity,
    specialInstructions: item.specialInstructions,
    modifiers:           groupModifierChoices(item.modifierChoices),
    createdAt:           item.createdAt.toISOString(),
    updatedAt:           item.updatedAt.toISOString(),
});

const CART_ITEM_INCLUDE = {
    modifierChoices: {
        select: { modifierId: true, choiceId: true },
    },
} as const;

// ─── Storage Client ──────────────────────────────────────────────────

export abstract class CartStorageClient {
    static async getActiveOrderSummary(userId: string): Promise<IActiveOrderSummary | undefined> {
        const order = await usePrismaClient(prisma => prisma.orderSession.findFirst({
            where: {
                userId,
                cafeParts: {
                    some: {
                        status: { in: [...ACTIVE_ORDER_CAFE_PART_STATUSES] },
                    },
                },
            },
            include: {
                cafeParts: {
                    select: {
                        cafeId:                 true,
                        status:                 true,
                        buyOnDemandOrderNumber: true,
                        total:                  true,
                        waitTimeMin:            true,
                        waitTimeMax:            true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        }));

        if (!order) {
            return undefined;
        }

        return {
            orderSessionId: order.id,
            alias:          order.alias,
            phoneNumber:    order.phoneNumberWithCountryCode,
            cafeParts:      order.cafeParts.map(part => ({
                cafeId:                 part.cafeId,
                status:                 part.status as OrderCafePartStatus,
                buyOnDemandOrderNumber: part.buyOnDemandOrderNumber,
                total:                  part.total,
                waitTimeMin:            part.waitTimeMin,
                waitTimeMax:            part.waitTimeMax,
            } satisfies IOrderCafePartSummary)),
        };
    }

    private static async ensureNoActiveOrder(tx: PrismaTransactionClient, userId: string): Promise<void> {
        const activeOrder = await tx.orderSession.findFirst({
            where: {
                userId,
                cafeParts: {
                    some: {
                        status: { in: [...ACTIVE_ORDER_CAFE_PART_STATUSES] },
                    },
                },
            },
            select: { id: true },
        });
        if (activeOrder) {
            throw new ServiceError(
                SERVICE_ERROR_CODES.CONFLICT,
                'Cannot modify cart while an order is active. Finish or abandon your current order first.',
            );
        }
    }

    private static async getOrCreateCart(tx: PrismaTransactionClient, userId: string) {
        const existing = await tx.cart.findUnique({
            where:   { userId },
            include: { items: { include: CART_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } } },
        });
        if (existing) {
            return existing;
        }
        return tx.cart.create({
            data:    { userId },
            include: { items: { include: CART_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } } },
        });
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

    static async buildCartResponse(userId: string): Promise<ICartResponse> {
        const cart = await usePrismaClient(prisma => prisma.cart.findUnique({
            where:   { userId },
            include: { items: { include: CART_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } } },
        }));
        const activeOrder = await this.getActiveOrderSummary(userId);
        return {
            items:       cart?.items.map(toCartItemRecord) ?? [],
            activeOrder,
        };
    }

    static async getCart(userId: string): Promise<ICartResponse> {
        await usePrismaWrite(prisma => this.getOrCreateCart(prisma as PrismaTransactionClient, userId));
        return this.buildCartResponse(userId);
    }

    static async addItem(userId: string, item: ICartItemData): Promise<ICartResponse> {
        await usePrismaTransaction(async tx => {
            await this.ensureNoActiveOrder(tx, userId);
            const cart = await this.getOrCreateCart(tx, userId);
            const created = await tx.cartItem.create({
                data: {
                    cartUserId:          cart.userId,
                    menuItemId:          item.menuItemId,
                    quantity:            item.quantity,
                    specialInstructions: item.specialInstructions ?? null,
                },
            });
            await this.createModifierChoices(tx, created.id, item.modifiers);
        });
        return this.buildCartResponse(userId);
    }

    static async updateItem(userId: string, itemId: string, update: ICartItemUpdate): Promise<ICartResponse> {
        await usePrismaTransaction(async tx => {
            await this.ensureNoActiveOrder(tx, userId);
            const cart = await this.getOrCreateCart(tx, userId);
            if (!cart.items.some(i => i.id === itemId)) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cart item ${itemId} not found`);
            }

            const data: Record<string, unknown> = {};
            if (update.quantity !== undefined) data.quantity = update.quantity;
            if (update.specialInstructions !== undefined) data.specialInstructions = update.specialInstructions;

            if (Object.keys(data).length > 0) {
                await tx.cartItem.update({ where: { id: itemId }, data });
            }

            if (update.modifiers !== undefined) {
                await tx.cartItemModifierChoice.deleteMany({ where: { cartItemId: itemId } });
                await this.createModifierChoices(tx, itemId, update.modifiers);
            }
        });
        return this.buildCartResponse(userId);
    }

    static async removeItem(userId: string, itemId: string): Promise<ICartResponse> {
        await usePrismaTransaction(async tx => {
            await this.ensureNoActiveOrder(tx, userId);
            const cart = await this.getOrCreateCart(tx, userId);
            if (!cart.items.some(i => i.id === itemId)) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cart item ${itemId} not found`);
            }
            await tx.cartItem.delete({ where: { id: itemId } });
        });
        return this.buildCartResponse(userId);
    }

    static async clearCart(userId: string): Promise<ICartResponse> {
        await usePrismaTransaction(async tx => {
            await this.ensureNoActiveOrder(tx, userId);
            const cart = await this.getOrCreateCart(tx, userId);
            await tx.cartItem.deleteMany({ where: { cartUserId: cart.userId } });
        });
        return this.buildCartResponse(userId);
    }
}

// ─── Service commands ────────────────────────────────────────────────

export const cartServiceCommands = {
    getCart: async ({ userId }: { userId: string }) =>
        CartStorageClient.getCart(userId),
    addItem: async ({ userId, item }: { userId: string; item: ICartItemData }) =>
        CartStorageClient.addItem(userId, item),
    updateItem: async ({ userId, itemId, update }: { userId: string; itemId: string; update: ICartItemUpdate }) =>
        CartStorageClient.updateItem(userId, itemId, update),
    removeItem: async ({ userId, itemId }: { userId: string; itemId: string }) =>
        CartStorageClient.removeItem(userId, itemId),
    clearCart: async ({ userId }: { userId: string }) =>
        CartStorageClient.clearCart(userId),
} satisfies ICartService;
