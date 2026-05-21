import { usePrismaClient, usePrismaWrite } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import type { PrismaLikeClient } from '../../../../shared/models/prisma.js';
import type {
    ICartService,
    ICartItemData,
    ICartItemUpdate,
    ICartItemRecord,
    ICartResponse,
    ISerializedModifier,
    IActiveOrderSummary,
} from '../../../../shared/services/cart.js';

const ACTIVE_ORDER_STATUSES = ['pending', 'payment_pending'];

const parseModifiers = (json: string): ISerializedModifier[] => {
    try {
        return JSON.parse(json);
    } catch {
        return [];
    }
};

const toCartItemRecord = (item: {
    id: string;
    cafeId: string;
    menuItemId: string;
    quantity: number;
    specialInstructions: string | null;
    modifiersJson: string;
    createdAt: Date;
    updatedAt: Date;
}): ICartItemRecord => ({
    id:                  item.id,
    cafeId:              item.cafeId,
    menuItemId:          item.menuItemId,
    quantity:            item.quantity,
    specialInstructions: item.specialInstructions,
    modifiers:           parseModifiers(item.modifiersJson),
    createdAt:           item.createdAt.toISOString(),
    updatedAt:           item.updatedAt.toISOString(),
});

const getActiveOrderSummary = async (userId: string): Promise<IActiveOrderSummary | undefined> => {
    const order = await usePrismaClient(prisma => prisma.order.findFirst({
        where: {
            userId,
            cafeOrders: {
                some: {
                    status: { in: ACTIVE_ORDER_STATUSES },
                },
            },
        },
        include: {
            cafeOrders: {
                select: {
                    cafeId:         true,
                    status:         true,
                    bodOrderNumber: true,
                    total:          true,
                    waitTimeMin:    true,
                    waitTimeMax:    true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    }));

    if (!order) {
        return undefined;
    }

    return {
        orderId:     order.id,
        alias:       order.alias,
        phoneNumber: order.phoneNumberWithCountryCode,
        cafeOrders:  order.cafeOrders,
    };
};

/**
 * Checks for an active order using the provided Prisma client.
 * Called inside usePrismaWrite so the check + mutation are serialized
 * under the write semaphore — no race between check and write.
 */
const ensureNoActiveOrderWithClient = async (prisma: PrismaLikeClient, userId: string): Promise<void> => {
    const activeOrder = await prisma.order.findFirst({
        where: {
            userId,
            cafeOrders: {
                some: {
                    status: { in: ACTIVE_ORDER_STATUSES },
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
};

const getOrCreateCartWithClient = async (prisma: PrismaLikeClient, userId: string) => {
    const existing = await prisma.cart.findUnique({
        where:   { userId },
        include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) {
        return existing;
    }
    return prisma.cart.create({
        data:    { userId },
        include: { items: { orderBy: { createdAt: 'asc' } } },
    });
};

const buildCartResponse = async (userId: string): Promise<ICartResponse> => {
    const cart = await usePrismaClient(prisma => prisma.cart.findUnique({
        where:   { userId },
        include: { items: { orderBy: { createdAt: 'asc' } } },
    }));
    const activeOrder = await getActiveOrderSummary(userId);
    return {
        items:       cart?.items.map(toCartItemRecord) ?? [],
        activeOrder: activeOrder,
    };
};

export const cartServiceCommands = {
    getCart: async ({ userId }: { userId: string }): Promise<ICartResponse> => {
        // getCart is read-only — doesn't need the write lock, but does
        // ensure the cart exists for convenience.
        await usePrismaWrite(prisma => getOrCreateCartWithClient(prisma, userId));
        return buildCartResponse(userId);
    },

    addItem: async ({ userId, item }: { userId: string; item: ICartItemData }): Promise<ICartResponse> => {
        await usePrismaWrite(async prisma => {
            await ensureNoActiveOrderWithClient(prisma, userId);
            const cart = await getOrCreateCartWithClient(prisma, userId);
            await prisma.cartItem.create({
                data: {
                    cartId:              cart.id,
                    cafeId:              item.cafeId,
                    menuItemId:          item.menuItemId,
                    quantity:            item.quantity,
                    specialInstructions: item.specialInstructions ?? null,
                    modifiersJson:       JSON.stringify(item.modifiers),
                },
            });
        });
        return buildCartResponse(userId);
    },

    updateItem: async ({ userId, itemId, update }: { userId: string; itemId: string; update: ICartItemUpdate }): Promise<ICartResponse> => {
        await usePrismaWrite(async prisma => {
            await ensureNoActiveOrderWithClient(prisma, userId);
            const cart = await getOrCreateCartWithClient(prisma, userId);
            if (!cart.items.some(i => i.id === itemId)) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cart item ${itemId} not found`);
            }

            const data: Record<string, unknown> = {};
            if (update.quantity !== undefined) data.quantity = update.quantity;
            if (update.specialInstructions !== undefined) data.specialInstructions = update.specialInstructions;
            if (update.modifiers !== undefined) data.modifiersJson = JSON.stringify(update.modifiers);

            await prisma.cartItem.update({ where: { id: itemId }, data });
        });
        return buildCartResponse(userId);
    },

    removeItem: async ({ userId, itemId }: { userId: string; itemId: string }): Promise<ICartResponse> => {
        await usePrismaWrite(async prisma => {
            await ensureNoActiveOrderWithClient(prisma, userId);
            const cart = await getOrCreateCartWithClient(prisma, userId);
            if (!cart.items.some(i => i.id === itemId)) {
                throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `Cart item ${itemId} not found`);
            }
            await prisma.cartItem.delete({ where: { id: itemId } });
        });
        return buildCartResponse(userId);
    },

    clearCart: async ({ userId }: { userId: string }): Promise<ICartResponse> => {
        await usePrismaWrite(async prisma => {
            await ensureNoActiveOrderWithClient(prisma, userId);
            const cart = await getOrCreateCartWithClient(prisma, userId);
            await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
        });
        return buildCartResponse(userId);
    },
} satisfies ICartService;
