import { usePrismaClient, usePrismaTransaction } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { MenuItemStorageClient } from './menu-item.js';
import { toDateString } from '@msdining/common/util/date-util';
import type { PrismaTransactionClient, ReadOnlyPrismaLikeClient } from '../../../../shared/models/prisma.js';
import type { ICartService } from '../../../../shared/services/cart.js';
import type {
    ICartItemData,
    ICartItemUpdate,
    ICartItemRecord,
    ISerializedModifier,
    IActiveOrderSummary,
    IOrderCafePartSummary,
    OrderCafePartStatus,
} from '@msdining/common/models/cart';
import { ACTIVE_ORDER_CAFE_PART_STATUSES } from '@msdining/common/models/cart';
import type { IMenuItemBase } from '@msdining/common/models/cafe';

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

// ─── Storage Client ──────────────────────────────────────────────────

const ACTIVE_ORDER_QUERY = {
    cafeParts: {
        some: {
            status: { in: [...ACTIVE_ORDER_CAFE_PART_STATUSES] },
        },
    },
};

const ACTIVE_ORDER_INCLUDE = {
    cafeParts: {
        select: {
            cafeId:                 true,
            status:                 true,
            buyOnDemandOrderNumber: true,
            total:                  true,
            waitTimeMin:            true,
            waitTimeMax:            true,
            items:                  { include: CART_ITEM_INCLUDE },
        },
    },
};

type ActiveOrderRow = {
    id: string;
    alias: string | null;
    phoneNumberWithCountryCode: string | null;
    cafeParts: {
        cafeId: string;
        status: string;
        buyOnDemandOrderNumber: string | null;
        total: number | null;
        waitTimeMin: number | null;
        waitTimeMax: number | null;
        items: PrismaCartItemWithModifiers[];
    }[];
};

const toActiveOrderSummary = async (order: ActiveOrderRow): Promise<IActiveOrderSummary> => {
    const cafeParts: IOrderCafePartSummary[] = [];

    for (const part of order.cafeParts) {
        const items: ICartItemRecord[] = [];
        for (const item of part.items) {
            const menuItem = await MenuItemStorageClient.retrieveMenuItemAsync(item.menuItemId);
            if (menuItem) {
                items.push(toCartItemRecord(item, menuItem, true));
            }
        }

        cafeParts.push({
            cafeId:                 part.cafeId,
            status:                 part.status as OrderCafePartStatus,
            buyOnDemandOrderNumber: part.buyOnDemandOrderNumber,
            total:                  part.total,
            waitTimeMin:            part.waitTimeMin,
            waitTimeMax:            part.waitTimeMax,
            items,
        });
    }

    return {
        orderSessionId: order.id,
        alias:          order.alias,
        phoneNumber:    order.phoneNumberWithCountryCode,
        cafeParts,
    };
};

export abstract class CartStorageClient {
    static async getActiveOrderSummary(userId: string): Promise<IActiveOrderSummary | undefined> {
        return usePrismaClient(prisma => this.getActiveOrderSummaryWithClient(prisma, userId));
    }

    private static async getActiveOrderSummaryWithClient(prisma: ReadOnlyPrismaLikeClient, userId: string): Promise<IActiveOrderSummary | undefined> {
        const order = await prisma.orderSession.findFirst({
            where:   { userId, ...ACTIVE_ORDER_QUERY },
            include: ACTIVE_ORDER_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });
        return order ? toActiveOrderSummary(order) : undefined;
    }

    /**
     * Check which of the given menu item IDs are available on today's menu.
     * Single batch query against DailyMenuItem — no per-cafe fan-out.
     */
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

    /**
     * Read the cart items + active order inside the transaction for consistency.
     * Does NOT check availability — that runs outside the transaction to avoid
     * deadlocking (the availability query uses usePrismaClient/read semaphore,
     * which can't proceed while the write semaphore is held).
     */
    private static async readRawCartData(tx: PrismaTransactionClient, userId: string) {
        const cart = await tx.cart.findUnique({
            where:   { userId },
            include: { items: { include: CART_ITEM_INCLUDE, orderBy: { createdAt: 'asc' } } },
        });
        const activeOrder = await this.getActiveOrderSummaryWithClient(tx, userId);
        return { items: cart?.items ?? [], activeOrder };
    }

    /**
     * Enrich raw cart data with full IMenuItemBase and availability info.
     * Runs outside the transaction so the availability + cache lookups
     * don't deadlock on the read semaphore.
     */
    private static async enrichCartResponse(
        rawItems: Awaited<ReturnType<typeof CartStorageClient.readRawCartData>>['items'],
        activeOrder: IActiveOrderSummary | undefined,
    ) {
        if (rawItems.length === 0) {
            return { items: [], activeOrder };
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
                // Menu item was deleted from the DB entirely — skip it
                continue;
            }
            items.push(toCartItemRecord(raw, menuItem, availableIds.has(raw.menuItemId)));
        }

        return { items, activeOrder };
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

    /** Cart row with items and modifier choices, as returned by getOrCreateCart. */
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

    /**
     * Run a cart mutation inside a transaction.
     * Optionally checks for an active order (rejects with CONFLICT if one exists),
     * ensures the cart exists, calls the callback, then reads the cart data
     * inside the transaction for consistency. Availability enrichment runs
     * after the transaction commits to avoid deadlocking on the read semaphore.
     */
    private static async useCartTransaction(
        userId: string,
        options: { requireNoActiveOrder: boolean },
        callback: (tx: PrismaTransactionClient, cart: Awaited<ReturnType<typeof CartStorageClient.getOrCreateCart>>) => Promise<void>,
    ) {
        const rawData = await usePrismaTransaction(async tx => {
            if (options.requireNoActiveOrder) {
                await this.ensureNoActiveOrder(tx, userId);
            }
            const cart = await this.getOrCreateCart(tx, userId);
            await callback(tx, cart);
            return this.readRawCartData(tx, userId);
        });
        return this.enrichCartResponse(rawData.items, rawData.activeOrder);
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
        return this.useCartTransaction(userId, { requireNoActiveOrder: false }, async () => {});
    }

    static async addItem(userId: string, item: ICartItemData) {
        return this.useCartTransaction(userId, { requireNoActiveOrder: true }, async (tx, cart) => {
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
    }

    static async updateItem(userId: string, itemId: string, update: ICartItemUpdate) {
        return this.useCartTransaction(userId, { requireNoActiveOrder: true }, async (tx, cart) => {
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
    }

    static async removeItem(userId: string, itemId: string) {
        return this.useCartTransaction(userId, { requireNoActiveOrder: true }, async (tx, cart) => {
            if (!cart.items.some(i => i.id === itemId)) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cart item ${itemId} not found`);
            }
            await tx.cartItem.delete({ where: { id: itemId } });
        });
    }

    static async clearCart(userId: string) {
        return this.useCartTransaction(userId, { requireNoActiveOrder: true }, async (tx, cart) => {
            await tx.cartItem.deleteMany({ where: { cartUserId: cart.userId } });
        });
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
