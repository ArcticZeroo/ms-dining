import { usePrismaTransaction, usePrismaWrite } from '../client.js';
import { ServiceError, SERVICE_ERROR_CODES } from '../../../rpc/errors.js';
import { CartStorageClient } from './cart.js';
import type {
    PrismaTransactionClient,
    ReadOnlyPrismaLikeClient,
} from '../../../../shared/models/prisma.js';
import { ACTIVE_ORDER_CAFE_PART_STATUSES } from '@msdining/common/models/cart';
import type { IActiveOrderSummary, OrderCafePartStatus } from '@msdining/common/models/cart';

interface IOrderCafePartData {
    buyOnDemandOrderId?: string;
    buyOnDemandOrderNumber?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
    waitTimeMin?: number;
    waitTimeMax?: number;
    lastError?: string;
    lastStage?: string;
    completedAt?: Date;
}

export abstract class OrderStorageClient {
    /**
     * Creates an order session and transfers cart items into it, grouped by cafe.
     * Rejects if the user already has an active order or the cart is empty.
     * Returns the order session ID and the set of cafeIds that received items.
     */
    static async startOrder(
        userId: string,
        alias: string,
        phoneNumberWithCountryCode: string,
    ): Promise<{ activeOrder: IActiveOrderSummary; cafeIds: string[] }> {
        const { orderSessionId, cafeIds } = await usePrismaTransaction(async tx => {
            // Reject if the user already has an active order
            const existing = await tx.orderSession.findFirst({
                where: {
                    userId,
                    cafeParts: {
                        some: { status: { in: [...ACTIVE_ORDER_CAFE_PART_STATUSES] } },
                    },
                },
                select: { id: true },
            });
            if (existing) {
                throw new ServiceError(
                    SERVICE_ERROR_CODES.CONFLICT,
                    'An active order already exists. Finish or abandon it before checking out again.',
                );
            }

            const cartItems = await tx.cartItem.findMany({
                where:  { cartUserId: userId },
                select: { id: true, menuItem: { select: { cafeId: true } } },
            });

            if (cartItems.length === 0) {
                throw new ServiceError(SERVICE_ERROR_CODES.BAD_REQUEST, 'Cart is empty');
            }

            const orderSession = await tx.orderSession.create({
                data: { userId, alias, phoneNumberWithCountryCode },
            });

            // Group cart item IDs by cafe
            const itemsByCafe = new Map<string, string[]>();
            for (const item of cartItems) {
                const cafeId = item.menuItem.cafeId;
                const ids = itemsByCafe.get(cafeId) ?? [];
                ids.push(item.id);
                itemsByCafe.set(cafeId, ids);
            }

            // Create a cafe part per cafe and transfer the items
            for (const [cafeId, itemIds] of itemsByCafe) {
                const cafePart = await tx.orderCafePart.create({
                    data: { orderSessionId: orderSession.id, cafeId },
                });
                await tx.cartItem.updateMany({
                    where: { id: { in: itemIds } },
                    data:  { cartUserId: null, orderCafePartId: cafePart.id },
                });
            }

            return { orderSessionId: orderSession.id, cafeIds: [...itemsByCafe.keys()] };
        });

        // Enrich outside the transaction (menu item lookups use the read semaphore)
        const activeOrder = await CartStorageClient.getActiveOrderSummary(userId);
        if (!activeOrder || activeOrder.orderSessionId !== orderSessionId) {
            throw new ServiceError(SERVICE_ERROR_CODES.INTERNAL, 'Active order not found after creation');
        }

        return { activeOrder, cafeIds };
    }

    static async updateCafePartStatus(
        orderSessionId: string,
        cafeId: string,
        status: OrderCafePartStatus,
        data: IOrderCafePartData = {},
    ) {
        const { completedAt, ...restData } = data;

        return usePrismaWrite(prisma => prisma.orderCafePart.update({
            where: { orderSessionId_cafeId: { orderSessionId, cafeId } },
            data:  {
                status,
                ...restData,
                ...(status == 'completed'
                    ? { completedAt: completedAt ?? new Date() }
                    : completedAt != null
                        ? { completedAt }
                        : {}),
            },
        }));
    }

    static async getCafePart(
        client: ReadOnlyPrismaLikeClient,
        orderSessionId: string,
        cafeId: string,
    ) {
        const part = await client.orderCafePart.findUnique({
            where: { orderSessionId_cafeId: { orderSessionId, cafeId } },
            include: {
                items: {
                    include: { modifierChoices: { select: { modifierId: true, choiceId: true } } },
                },
            },
        });
        if (!part) {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, `No order part for cafe ${cafeId}`);
        }
        return part;
    }

    static async getOrderSession(
        client: ReadOnlyPrismaLikeClient,
        orderSessionId: string,
    ) {
        const order = await client.orderSession.findUnique({
            where:  { id: orderSessionId },
            select: { alias: true, phoneNumberWithCountryCode: true },
        });
        if (!order) {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'Order not found');
        }
        return order;
    }

    static async ensureOrderBelongsToUser(prismaTx: PrismaTransactionClient, orderSessionId: string, userId: string) {
        const order = await prismaTx.orderSession.findUnique({
            where:  { id: orderSessionId },
            select: { userId: true },
        });
        if (!order) {
            throw new ServiceError(SERVICE_ERROR_CODES.NOT_FOUND, 'Order not found');
        }
        if (order.userId != userId) {
            throw new ServiceError(SERVICE_ERROR_CODES.FORBIDDEN, 'Order does not belong to this user');
        }
    }

    static async setPaymentIdentity(
        userId: string,
        orderSessionId: string,
        alias: string,
        phoneNumberWithCountryCode: string,
    ): Promise<void> {
        await usePrismaTransaction(async prismaTx => {
            await this.ensureOrderBelongsToUser(prismaTx, orderSessionId, userId);

            await prismaTx.orderSession.update({
                where: { id: orderSessionId },
                data:  { alias, phoneNumberWithCountryCode },
            });
        });
    }

    static async abandonRemainingCafes(userId: string, orderSessionId: string): Promise<void> {
        await usePrismaTransaction(async prismaTx => {
            await this.ensureOrderBelongsToUser(prismaTx, orderSessionId, userId);

            // Find active cafe parts
            const activeParts = await prismaTx.orderCafePart.findMany({
                where: {
                    orderSessionId,
                    status: { in: [...ACTIVE_ORDER_CAFE_PART_STATUSES] },
                },
                select: { id: true },
            });

            if (activeParts.length === 0) {
                return;
            }

            const activePartIds = activeParts.map(p => p.id);

            // Mark them as abandoned
            await prismaTx.orderCafePart.updateMany({
                where: { id: { in: activePartIds } },
                data:  { status: 'abandoned' },
            });

            // Ensure the user has a cart to transfer items back to
            await prismaTx.cart.upsert({
                where:  { userId },
                create: { userId },
                update: {},
            });

            // Transfer items from abandoned parts back to the user's cart
            await prismaTx.cartItem.updateMany({
                where: { orderCafePartId: { in: activePartIds } },
                data:  { orderCafePartId: null, cartUserId: userId },
            });
        });
    }

    static async getActiveOrder(userId: string) {
        return CartStorageClient.getActiveOrderSummary(userId);
    }
}
